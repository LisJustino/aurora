import { hasSupabaseConfig, setRememberSession } from '../data/supabase-client.js';
import { accountPathForMode, accountModeFromLocation, isPublicLandingLocation } from '../core/router.js';
import { isNativeApp } from '../utils/platform.js';
import { NATIVE_AUTH_REDIRECT_URL } from '../utils/native-auth-callback.js';
import { validatePassword, PASSWORD_REQUIREMENTS_MESSAGE, PASSWORD_REJECTED_MESSAGE } from './password-policy.js';
import {
  authCallbackErrorMessage,
  genericAuthError,
  isExistingAccountSignup,
  isPasswordRecoveryCallback,
  isRejectedAccountSession,
  loginErrorMessage,
  passwordRecoveryErrorMessage,
  signupErrorMessage,
} from './account-errors.js';
import { createAccountForm, showConfigurationError } from './account-form.js';
import { getAccountClient, requestAccountDeletion } from './account-client.js';
import { setSubmitPending } from './account-form-fields.js';
import {
  MINIMUM_ACCOUNT_AGE,
  createLegalConsentMetadata,
  getOAuthRedirectUrl,
  hasCompleteProfile,
  hasCurrentCycleDataConsent,
  hasCurrentLegalConsent,
  hasSocialIdentity,
} from './account-consent.js';
import { calculateAge } from '../features/profile/birthday.js';

export {
  TERMS_DOCUMENT_VERSION,
  PRIVACY_POLICY_VERSION,
  CYCLE_DATA_CONSENT_VERSION,
  MINIMUM_ACCOUNT_AGE,
  createLegalConsentMetadata,
  hasCurrentLegalConsent,
  createCycleDataConsentMetadata,
  createCycleDataConsentRevocationMetadata,
  hasCurrentCycleDataConsent,
  hasCompleteProfile,
  hasSocialIdentity,
  getOAuthRedirectUrl,
} from './account-consent.js';
export {
  passwordRecoveryErrorMessage,
  isPasswordRecoveryCallback,
  authCallbackErrorMessage,
  AccountConflictError,
  isExistingAccountSignup,
  isAccountDeletionConfirmed,
  signupErrorMessage,
} from './account-errors.js';
export { getAccountClient, requestAccountDeletion } from './account-client.js';
export { getEmailDomainSuggestions } from './account-form-fields.js';
export { appendLegalConsent, createAccountForm, showAccountError } from './account-form.js';
export {
  loadAccountSlices,
  saveAccountSlice,
  importAccountSlices,
  replaceAccountSlices,
  deleteAccountData,
} from './account-slices.js';
export { calculateAge };
function navigateToAccountMode(mode, { replace = false } = {}) {
  const path = accountPathForMode(mode);
  if (!path) return;
  const url = new URL(location.href);
  const target = new URL(path, url.origin);
  url.pathname = target.pathname;
  url.searchParams.delete('etapa');
  target.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  url.hash = '';
  const destination = `${url.pathname}${url.search}`;
  if (`${location.pathname}${location.search}` === destination) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', destination);
}

export async function requireAccount(
  root,
  initialMode = 'login',
  {
    allowPublicReturn = false,
    onPublicReturn,
    onAccountDeleted,
    onFormReady,
    initialNotice = '',
    initialNoticeTone = '',
    authStylesReady = Promise.resolve(),
  } = {},
) {
  const callbackErrorMessage = authCallbackErrorMessage(location);
  if (callbackErrorMessage) {
    const callbackUrl = new URL(location.href);
    callbackUrl.searchParams.delete('error');
    callbackUrl.searchParams.delete('error_code');
    callbackUrl.searchParams.delete('error_description');
    history.replaceState(null, '', `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
  }
  const passwordRecoveryRequested = isPasswordRecoveryCallback(location) || initialMode === 'update-password';
  if (!hasSupabaseConfig()) {
    const isDevelopment = import.meta.env?.DEV === true;
    showConfigurationError(
      root,
      isDevelopment
        ? 'O ambiente de desenvolvimento não encontrou as configurações necessárias para acessar a conta.'
        : 'O acesso à conta está temporariamente indisponível. Tente novamente mais tarde.',
      isDevelopment ? 'Configuração necessária' : 'Acesso indisponível',
      false,
      isDevelopment,
    );
    return null;
  }

  let client;
  try {
    client = await getAccountClient();
  } catch (error) {
    console.error('Aurora: o cliente de contas não pôde ser inicializado.', error);
    showConfigurationError(
      root,
      'Não foi possível carregar o serviço seguro de contas. Verifique a conexão e tente novamente.',
      'A conta ainda não está configurada',
      allowPublicReturn,
    );
    return null;
  }

  const authPage = async (mode, email = '', notice = '', signupProfile = null, noticeTone = '') => {
    await authStylesReady;
    const copy = {
      login: [
        'Entrar na sua conta',
        'Entre para continuar com seus registros.',
        [
          { prompt: 'Ainda não tem uma conta?', label: 'Criar conta', target: 'signup' },
          { label: 'Esqueci minha senha', target: 'recovery' },
        ],
      ],
      'signup-profile': [
        'Seu perfil',
        'Comece com seus dados básicos.',
        [{ prompt: 'Já tem uma conta?', label: 'Entrar', target: 'login' }],
      ],
      'signup-access': [
        'Crie seu acesso',
        'Informe um e-mail que você acessa, escolha uma senha e aceite os documentos. Você poderá entrar assim que criar a conta.',
        [
          { label: 'Voltar aos seus dados', target: 'signup-profile' },
          { prompt: 'Já tem uma conta?', label: 'Entrar', target: 'login' },
        ],
      ],
      'oauth-profile': [
        'Complete seu perfil',
        'Para criar sua conta, informe seus dados e aceite os documentos.',
        [{ label: 'Cancelar e sair', target: 'oauth-profile-cancel' }],
      ],
      recovery: [
        'Recuperar acesso',
        'Enviaremos instruções para redefinir sua senha ao e-mail informado.',
        [{ label: 'Voltar para entrar', target: 'login' }],
      ],
      'update-password': [
        'Atualizar senha',
        'Escolha uma senha forte e exclusiva para sua conta. A redefinição não altera a senha do cofre antigo; para importar dados cifrados, use a senha original do cofre.',
        [{ label: 'Solicitar outro link', target: 'recovery' }],
      ],
      'legal-consent': [
        'Termos atualizados',
        'Para continuar usando o Aurora, leia e aceite a versão atualizada dos documentos. Se preferir recusar, você poderá revisar as etapas para confirmar a exclusão permanente da conta.',
        [],
      ],
      'delete-account': [
        'Confirmar exclusão da conta',
        'Você recusou os documentos. A conta e todos os dados associados serão excluídos permanentemente. Digite EXCLUIR abaixo para confirmar; essa ação não pode ser desfeita.',
        [{ label: 'Voltar e aceitar os termos', target: 'legal-consent' }],
      ],
    }[mode];
    if (accountPathForMode(mode)) {
      navigateToAccountMode(mode, {
        replace: mode === 'update-password' && isPasswordRecoveryCallback(location),
      });
    }
    const publicAuthMode = ['login', 'signup-profile', 'signup-access', 'recovery', 'update-password'].includes(mode);
    const links = [...copy[2]];
    if (allowPublicReturn && publicAuthMode) {
      links.push({ label: 'Voltar à demonstração', target: 'landing' });
    }
    onFormReady?.();
    const { form, message, submit } = createAccountForm(root, {
      title: copy[0],
      description: copy[1],
      mode,
      email,
      signupProfile,
      links,
      includePublicHeader: allowPublicReturn && publicAuthMode,
      noticeTone,
    });
    message.textContent = notice;
    const readSignupProfile = () => {
      if (mode !== 'signup-profile' && mode !== 'oauth-profile') return null;
      return {
        name: form.elements.name.value.trim(),
        preferredName: form.elements.preferredName.value.trim() || form.elements.name.value.trim().split(/\s+/)[0],
        ageConfirmed: form.elements.ageConfirmed.checked,
      };
    };
    const result = await new Promise((resolve) => {
      const finish = (value) => {
        window.removeEventListener('popstate', onPopState);
        resolve(value);
      };
      const onPopState = () => {
        const nextMode = accountModeFromLocation(location);
        if (nextMode) {
          finish({
            nextMode,
            email: form.elements.email?.value.trim() || email,
            signupProfile: readSignupProfile(),
          });
        } else if (allowPublicReturn && isPublicLandingLocation(location)) {
          finish({ nextMode: 'landing' });
        }
      };
      window.addEventListener('popstate', onPopState);
      form.addEventListener(
        'submit',
        (event) => {
          event.preventDefault();
          const profile = readSignupProfile();
          finish({
            email: form.elements.email?.value.trim() || email,
            password: form.elements.password?.value || '',
            confirmPassword: form.elements.confirmPassword?.value || '',
            rememberSession: form.elements.rememberSession?.checked === true,
            signupProfile: profile,
            termsAccepted:
              mode === 'signup-access' || mode === 'legal-consent' || mode === 'oauth-profile'
                ? form.elements.termsAccepted.checked
                : false,
            deleteConfirmation: mode === 'delete-account' ? form.elements.deleteConfirmation.value : '',
            submit,
            message,
          });
        },
        { once: true },
      );
      root.querySelector('[data-account-refuse-terms]')?.addEventListener(
        'click',
        () => {
          finish({ nextMode: 'delete-account' });
        },
        { once: true },
      );
      root.querySelectorAll('button[data-account-mode], a[data-account-mode]').forEach((control) => {
        control.addEventListener(
          'click',
          () => {
            const nextMode = control.dataset.accountMode;
            if (accountPathForMode(nextMode)) navigateToAccountMode(nextMode);
            finish({
              nextMode,
              email: form.elements.email?.value.trim() || email,
              signupProfile: readSignupProfile(),
            });
          },
          { once: true },
        );
      });
      form.querySelectorAll('button[data-oauth-provider]').forEach((control) => {
        control.addEventListener(
          'click',
          () =>
            finish({
              oauthProvider: control.dataset.oauthProvider,
              rememberSession: form.elements.rememberSession?.checked === true,
              submit,
              message,
              providerButtons: Array.from(form.querySelectorAll('button[data-oauth-provider]')),
            }),
          { once: true },
        );
      });
    });
    return result;
  };

  const deleteAccountAfterRefusal = async (user) => {
    let message = '';
    for (;;) {
      const result = await authPage('delete-account', user.email, message);
      if (result.nextMode === 'legal-consent') return false;
      if (result.deleteConfirmation !== 'EXCLUIR') {
        message = 'Digite EXCLUIR exatamente como aparece para confirmar a exclusão permanente.';
        continue;
      }
      setSubmitPending(result.submit, true);
      if (!(await requestAccountDeletion(client))) {
        setSubmitPending(result.submit, false);
        message =
          'A exclusão da conta não foi confirmada. Você poderá criar uma conta nova com este e-mail assim que a exclusão for concluída. Tente novamente ou volte para aceitar os termos.';
        continue;
      }

      const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
      if (signOutError)
        console.error('Aurora: a conta foi excluída, mas a sessão local não foi encerrada.', signOutError);
      onAccountDeleted?.();
      return true;
    }
  };

  const requireCurrentProfile = async (user) => {
    if (!hasSocialIdentity(user) || hasCompleteProfile(user)) return user;
    const metadata = user.user_metadata || {};
    const providerName = metadata.full_name || metadata.name || '';
    const profileDraft = {
      name: metadata.name || providerName,
      preferredName: metadata.preferred_name || providerName,
    };
    let message = '';
    for (;;) {
      const result = await authPage('oauth-profile', user.email, message, profileDraft);
      if (result.nextMode === 'oauth-profile-cancel') {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error)
          throw new Error(
            'Não foi possível encerrar a sessão. Tente novamente antes de compartilhar este dispositivo.',
          );
        if (allowPublicReturn) onPublicReturn?.();
        else location.reload();
        return null;
      }
      const profile = result.signupProfile;
      if (!profile || !profile.name || !profile.ageConfirmed) {
        message = `Preencha seu nome e confirme que você tem pelo menos ${MINIMUM_ACCOUNT_AGE} anos.`;
        continue;
      }
      if (!result.termsAccepted) {
        message = 'Marque a caixa para aceitar os Termos de Uso e a Política de Privacidade.';
        continue;
      }

      setSubmitPending(result.submit, true);
      const { data, error } = await client.auth.updateUser({
        data: {
          name: profile.name.slice(0, 50),
          preferred_name: profile.preferredName.slice(0, 50),
          age_confirmed: true,
          ...createLegalConsentMetadata(),
        },
      });
      if (error || !data.user) {
        console.error('Aurora: não foi possível salvar o perfil e o aceite da conta social.', error);
        setSubmitPending(result.submit, false);
        message = 'Não foi possível salvar seus dados e seu aceite. A conta não será aberta; tente novamente.';
        continue;
      }
      return data.user;
    }
  };

  const requireCurrentLegalConsent = async (user) => {
    user = await requireCurrentProfile(user);
    if (!user || hasCurrentLegalConsent(user)) return user;
    let message = '';
    for (;;) {
      const result = await authPage('legal-consent', user.email, message);
      if (result.nextMode === 'delete-account') {
        if (await deleteAccountAfterRefusal(user)) return null;
        continue;
      }
      if (!result.termsAccepted) {
        message = 'Marque a caixa para aceitar os documentos ou escolha recusar para revisar a exclusão da conta.';
        continue;
      }

      setSubmitPending(result.submit, true);
      const consent = createLegalConsentMetadata();
      const { data, error } = await client.auth.updateUser({ data: consent });
      if (error || !data.user) {
        console.error('Aurora: o aceite atualizado não pôde ser salvo na conta.', error);
        setSubmitPending(result.submit, false);
        message = 'Não foi possível registrar seu aceite. A conta não será aberta; tente novamente.';
        continue;
      }
      return data.user;
    }
  };

  try {
    const {
      data: { session },
      error,
    } = await client.auth.getSession();
    if (error) throw error;
    if (session?.user) {
      const canSpeculativelyLoad =
        !passwordRecoveryRequested &&
        hasCurrentLegalConsent(session.user) &&
        (!hasSocialIdentity(session.user) || hasCompleteProfile(session.user)) &&
        typeof client.rpc === 'function';
      const prefetchedIncludeCycle = canSpeculativelyLoad ? hasCurrentCycleDataConsent(session.user) : false;
      const prefetchedPromise = canSpeculativelyLoad
        ? Promise.resolve(client.rpc('load_relational_account', { p_include_cycle: prefetchedIncludeCycle })).catch(
            () => null,
          )
        : null;
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error(genericAuthError());
      if (passwordRecoveryRequested) {
        for (;;) {
          const result = await authPage('update-password');
          if (result.nextMode) continue;
          if (!validatePassword(result.password).valid) {
            result.message.textContent = PASSWORD_REQUIREMENTS_MESSAGE;
            continue;
          }
          if (result.password !== result.confirmPassword) {
            result.message.textContent = 'As senhas não coincidem.';
            continue;
          }
          setSubmitPending(result.submit, true);
          const { error: updateError } = await client.auth.updateUser({ password: result.password });
          if (updateError) {
            setSubmitPending(result.submit, false);
            result.message.textContent =
              updateError.code === 'weak_password' ? PASSWORD_REJECTED_MESSAGE : genericAuthError();
            continue;
          }
          const callbackUrl = new URL(location.href);
          ['type', 'code', 'error', 'error_code', 'error_description'].forEach((key) => {
            callbackUrl.searchParams.delete(key);
          });
          history.replaceState(null, '', `${callbackUrl.pathname}${callbackUrl.search}`);
          const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
          if (signOutError) {
            throw new Error(
              'Sua senha foi atualizada, mas não foi possível encerrar a sessão. Atualize a página e entre com a nova senha.',
            );
          }
          return requireAccount(root, 'login', {
            allowPublicReturn,
            onPublicReturn,
            onAccountDeleted,
            initialNotice: 'Senha atualizada. Entre usando sua nova senha.',
            initialNoticeTone: 'success',
          });
        }
      }
      const currentUser = await requireCurrentLegalConsent(user);
      if (!currentUser) return null;
      const canReusePrefetch =
        Boolean(prefetchedPromise) &&
        currentUser.id === session.user.id &&
        hasCurrentCycleDataConsent(currentUser) === prefetchedIncludeCycle;
      return {
        client,
        user: currentUser,
        ...(canReusePrefetch
          ? { prefetchedAccountLoad: { includeCycle: prefetchedIncludeCycle, promise: prefetchedPromise } }
          : {}),
      };
    }

    let mode =
      initialMode === 'signup'
        ? 'signup-profile'
        : ['signup-profile', 'signup-access', 'recovery', 'update-password'].includes(initialMode)
          ? initialMode
          : 'login';
    let email = '';
    let message = callbackErrorMessage || initialNotice;
    if (!callbackErrorMessage && mode === 'update-password' && !passwordRecoveryRequested) {
      message = 'Para definir uma nova senha, solicite um link de recuperação pelo seu e-mail.';
    }
    let messageTone = callbackErrorMessage ? '' : initialNoticeTone;
    let profileDraft = null;
    for (;;) {
      let authenticatedUser = null;
      const result = await authPage(mode, email, message, profileDraft, messageTone);
      if (result.nextMode) {
        if (result.nextMode === 'landing' && allowPublicReturn) {
          onPublicReturn?.();
          return null;
        }
        email = result.email || email;
        profileDraft = result.signupProfile || profileDraft;
        mode = result.nextMode === 'signup' ? 'signup-profile' : result.nextMode;
        message = '';
        messageTone = '';
        continue;
      }
      email = result.email || email;
      if (result.oauthProvider) {
        if (result.oauthProvider !== 'google') {
          throw new Error('Provedor de acesso não permitido.');
        }
        setRememberSession(result.rememberSession);
        setSubmitPending(result.submit, true);
        result.providerButtons.forEach((button) => {
          button.disabled = true;
        });
        let oauthError;
        try {
          if (isNativeApp()) {
            const { startNativeOAuth } = await import('./native-auth.js');
            await startNativeOAuth(client, result.oauthProvider);
          } else {
            const oauthResult = await client.auth.signInWithOAuth({
              provider: result.oauthProvider,
              options: { redirectTo: getOAuthRedirectUrl(location.origin) },
            });
            oauthError = oauthResult.error;
          }
        } catch (error) {
          oauthError = error;
        }
        if (oauthError) {
          console.error(`Aurora: não foi possível iniciar o acesso por ${result.oauthProvider}.`, oauthError);
          setSubmitPending(result.submit, false);
          result.providerButtons.forEach((button) => {
            button.disabled = false;
          });
          message =
            'Não foi possível iniciar o acesso. Verifique se o provedor está habilitado em Authentication → Sign In / Providers no Supabase.';
          continue;
        }
        return null;
      }
      if (mode === 'recovery') {
        setSubmitPending(result.submit, true);
        const { error: recoveryError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: isNativeApp() ? NATIVE_AUTH_REDIRECT_URL : `${location.origin}${location.pathname}`,
        });
        message = recoveryError
          ? passwordRecoveryErrorMessage(recoveryError)
          : 'Se houver uma conta vinculada a esse e-mail, você receberá instruções para redefinir a senha. Confira também o spam e aguarde alguns minutos.';
        messageTone = recoveryError ? '' : 'success';
        result.message.textContent = message;
        result.message.dataset.tone = messageTone;
        result.message.setAttribute('role', recoveryError ? 'alert' : 'status');
        result.message.setAttribute('aria-live', recoveryError ? 'assertive' : 'polite');
        setSubmitPending(result.submit, false);
        continue;
      }
      if (mode === 'update-password') {
        message = 'Este link não está mais ativo. Solicite novas instruções para redefinir sua senha.';
        mode = 'recovery';
        continue;
      }
      if (mode === 'signup-profile') {
        if (!result.signupProfile || !result.signupProfile.name || !result.signupProfile.ageConfirmed) {
          message = `Preencha seus dados e confirme que você tem pelo menos ${MINIMUM_ACCOUNT_AGE} anos para criar uma conta.`;
          continue;
        }
        profileDraft = result.signupProfile;
        mode = 'signup-access';
        message = '';
        continue;
      }
      if (mode === 'signup-access') {
        if (!profileDraft || !profileDraft.ageConfirmed) {
          mode = 'signup-profile';
          message = 'Confirme seus dados e a idade mínima para continuar o cadastro.';
          continue;
        }
        if (!result.termsAccepted) {
          message = 'Leia e aceite os Termos de Uso e a Política de Privacidade para criar uma conta.';
          continue;
        }
        if (!validatePassword(result.password).valid) {
          message = PASSWORD_REQUIREMENTS_MESSAGE;
          continue;
        }
        setSubmitPending(result.submit, true);
        const { data, error: signupError } = await client.auth.signUp({
          email,
          password: result.password,
          options: {
            emailRedirectTo: `${location.origin}${location.pathname}`,
            data: {
              name: profileDraft.name.slice(0, 50),
              preferred_name: profileDraft.preferredName.slice(0, 50),
              age_confirmed: true,
              ...createLegalConsentMetadata(),
            },
          },
        });
        if (signupError) {
          setSubmitPending(result.submit, false);
          message = signupErrorMessage(signupError, data);
          continue;
        }
        if (!data.session || !data.user) {
          if (isExistingAccountSignup(null, data)) {
            setSubmitPending(result.submit, false);
            message = signupErrorMessage(null, data);
            continue;
          }
          const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
          if (signOutError) throw new Error(genericAuthError());
          setSubmitPending(result.submit, false);
          message =
            'Este projeto Supabase está exigindo confirmação de e-mail. No projeto de desenvolvimento, desative Authentication → Providers → Email → Confirm email e tente novamente. Esta tentativa pode ter criado uma conta pendente; confira-a no painel antes de repetir o cadastro.';
          continue;
        }
        authenticatedUser = data.user;
      } else {
        setSubmitPending(result.submit, true);
        if (mode === 'login') setRememberSession(result.rememberSession);
        const { data, error: loginError } = await client.auth.signInWithPassword({
          email,
          password: result.password,
        });
        if (loginError || !data.user) {
          setSubmitPending(result.submit, false);
          if (loginError?.code === 'email_not_confirmed') {
            message =
              'Esta conta foi criada quando a confirmação de e-mail estava ativa. Para entrar sem receber link, confirme-a manualmente em Authentication → Users no projeto Supabase; depois, entre novamente. Novos cadastros não exigem confirmação.';
            messageTone = '';
            continue;
          }
          message = loginErrorMessage(loginError);
          messageTone = '';
          continue;
        }
        authenticatedUser = data.user;
      }

      const {
        data: { user },
        error: userError,
      } = authenticatedUser ? { data: { user: authenticatedUser }, error: null } : await client.auth.getUser();
      if (userError || !user) {
        message = genericAuthError();
        continue;
      }
      const currentUser = await requireCurrentLegalConsent(user);
      if (!currentUser) return null;
      const includeCycle = hasCurrentCycleDataConsent(currentUser);
      const prefetchedAccountLoad =
        typeof client.rpc === 'function'
          ? {
              includeCycle,
              promise: Promise.resolve(client.rpc('load_relational_account', { p_include_cycle: includeCycle })).catch(
                () => null,
              ),
            }
          : null;
      return {
        client,
        user: currentUser,
        ...(prefetchedAccountLoad ? { prefetchedAccountLoad } : {}),
      };
    }
  } catch (error) {
    let sessionCleared = false;
    if (isRejectedAccountSession(error)) {
      try {
        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        sessionCleared = true;
      } catch (signOutError) {
        console.error('Aurora: não foi possível limpar uma sessão recusada pelo serviço de contas.', signOutError);
      }
    }
    const message = isRejectedAccountSession(error)
      ? sessionCleared
        ? 'Sua sessão expirou. Entre novamente para continuar.'
        : 'Não foi possível validar ou encerrar sua sessão. Confira a conexão e tente novamente; a sessão salva foi mantida.'
      : 'Não foi possível verificar sua sessão. Confira a conexão e tente novamente; a sessão salva foi mantida.';
    showConfigurationError(root, message, 'Não foi possível acessar a conta');
    return null;
  }
}
