import { iconSvg } from '../utils/icons.js';
import {
  LEGACY_PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from './password-policy.js';

const EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'outlook.com.br',
  'hotmail.com.br',
  'yahoo.com.br',
  'uol.com.br',
  'bol.com.br',
];

export function getEmailDomainSuggestions(value) {
  if (typeof value !== 'string') return [];
  const separator = value.lastIndexOf('@');
  if (separator <= 0 || value.indexOf('@') !== separator) return [];
  const localPart = value.slice(0, separator);
  const domainPrefix = value.slice(separator + 1).toLowerCase();
  return EMAIL_DOMAINS.filter((domain) => domain.startsWith(domainPrefix) && domain !== domainPrefix).map(
    (domain) => `${localPart}@${domain}`,
  );
}

export const create = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export function setAccountFieldError(input, message) {
  const field = input.closest('.account-field');
  if (!field) return;
  let error = field.querySelector('.account-field-error');
  if (!message) {
    if (error) {
      input.setAttribute(
        'aria-describedby',
        (input.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .filter((id) => id && id !== error.id)
          .join(' '),
      );
      error.remove();
    }
    input.removeAttribute('aria-invalid');
    return;
  }
  if (!error) {
    error = create('small', 'field-err account-field-error');
    error.id = `${input.id}-error`;
    field.append(error);
  }
  error.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  input.setAttribute('aria-describedby', [...describedBy].join(' '));
}

function attachEmailSuggestions(input) {
  const field = input.closest('.account-field');
  if (!field) return;

  const listId = `${input.id}-suggestions`;
  const popup = create('div', 'account-email-suggestions');
  const list = create('div', 'account-email-suggestion-list');
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Sugestões de provedores de e-mail');
  const hint = create('small', 'account-email-suggestion-hint', 'Digite mais para filtrar ou continue seu e-mail.');
  popup.append(list, hint);
  popup.hidden = true;
  field.append(popup);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-expanded', 'false');

  let activeIndex = -1;
  let suggestions = [];

  const close = () => {
    popup.hidden = true;
    field.classList.remove('has-email-suggestions');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  };

  const setActive = (index) => {
    activeIndex = (index + suggestions.length) % suggestions.length;
    [...list.children].forEach((option, optionIndex) => {
      const active = optionIndex === activeIndex;
      option.setAttribute('aria-selected', String(active));
      if (active) input.setAttribute('aria-activedescendant', option.id);
    });
  };

  const select = (suggestion) => {
    input.value = suggestion;
    close();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  };

  const refresh = () => {
    suggestions = getEmailDomainSuggestions(input.value).slice(0, 4);
    list.replaceChildren();
    if (!suggestions.length) {
      close();
      return;
    }

    suggestions.forEach((suggestion, index) => {
      const option = create('div', 'account-email-suggestion', suggestion);
      option.id = `${listId}-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.addEventListener('pointermove', () => setActive(index));
      option.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        select(suggestion);
      });
      list.append(option);
    });
    popup.hidden = false;
    field.classList.add('has-email-suggestions');
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  };

  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (popup.hidden) refresh();
      if (suggestions.length) {
        event.preventDefault();
        const nextIndex =
          activeIndex < 0
            ? event.key === 'ArrowDown'
              ? 0
              : suggestions.length - 1
            : activeIndex + (event.key === 'ArrowDown' ? 1 : -1);
        setActive(nextIndex);
      }
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      select(suggestions[activeIndex]);
    } else if (event.key === 'Escape' && !popup.hidden) {
      event.preventDefault();
      close();
    }
  });
}

export function createField(form, labelText, name, type, autocomplete, value = '', helpText = '', container = form) {
  const wrapper = create('div', 'account-field');
  const label = create('label', '', labelText);
  const input = create('input', 'field', '');
  input.name = name;
  input.type = type;
  input.autocomplete = autocomplete;
  input.required = true;
  input.value = value;
  if (type === 'email') input.maxLength = 254;
  if (name === 'password' || name === 'confirmPassword') {
    input.minLength = LEGACY_PASSWORD_MIN_LENGTH;
    input.maxLength = PASSWORD_MAX_LENGTH;
  }
  if (name === 'email') input.placeholder = 'voce@email.com';
  if (name === 'password') input.placeholder = 'sua senha';
  if (name === 'confirmPassword') input.placeholder = 'confirme sua senha';
  if (name === 'recoveryKey') {
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.maxLength = 43;
    input.pattern = '[A-Za-z0-9_-]{43}';
  }
  label.htmlFor = `account-${name}`;
  input.id = label.htmlFor;
  const control = create('div', type === 'password' ? 'account-password-control' : 'account-input-control');
  control.append(input);
  if (type === 'password') {
    const reveal = create('button', 'account-password-toggle');
    reveal.type = 'button';
    reveal.setAttribute('aria-label', `Mostrar ${labelText.toLowerCase()}`);
    reveal.setAttribute('aria-controls', input.id);
    reveal.setAttribute('aria-pressed', 'false');
    reveal.title = 'Mostrar senha';
    reveal.innerHTML = iconSvg('eye');
    reveal.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', String(visible));
      reveal.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${labelText.toLowerCase()}`);
      reveal.title = `${visible ? 'Ocultar' : 'Mostrar'} senha`;
      reveal.innerHTML = iconSvg(visible ? 'eyeOff' : 'eye');
      input.focus();
    });
    control.append(reveal);
  }
  wrapper.append(label, control);
  if (helpText) {
    const help = create('small', 'account-field-help', helpText);
    help.id = `${input.id}-help`;
    input.setAttribute('aria-describedby', help.id);
    wrapper.append(help);
  }
  input.addEventListener('invalid', () => setAccountFieldError(input, input.validationMessage));
  input.addEventListener('input', () => {
    if (input.validity.valid) setAccountFieldError(input, '');
  });
  container.append(wrapper);
  if (type === 'email' && name === 'email') attachEmailSuggestions(input);
  return input;
}

// Troca a dica fixa do campo de senha por uma contagem enquanto a pessoa digita, para ela saber por que o botão
// ainda está desabilitado. Sem aria-live de propósito: anunciar a cada tecla atrapalha quem usa leitor de tela.
export function bindPasswordLengthHint(input) {
  const help = input.closest('.account-field')?.querySelector('.account-field-help');
  if (!help) return;
  const update = () => {
    const missing = PASSWORD_MIN_LENGTH - input.value.length;
    if (!input.value) {
      help.textContent = PASSWORD_REQUIREMENTS_MESSAGE;
      delete help.dataset.state;
    } else if (missing > 0) {
      help.textContent = `Faltam ${missing} ${missing === 1 ? 'caractere' : 'caracteres'} (mínimo de ${PASSWORD_MIN_LENGTH}).`;
      help.dataset.state = 'short';
    } else {
      help.textContent = 'Tamanho da senha ok.';
      help.dataset.state = 'ok';
    }
  };
  input.addEventListener('input', update);
}

export function createFormGroup(className, legendText) {
  const group = create('fieldset', className);
  group.append(create('legend', '', legendText));
  return group;
}

export function setSubmitPending(button, pending) {
  if (pending) {
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
    const spinner = create('span', 'account-spinner');
    spinner.setAttribute('aria-hidden', 'true');
    const label = create('span', '', 'aguarde…');
    button.replaceChildren(spinner, label);
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.defaultLabel || button.textContent;
  button.classList.remove('is-loading');
  button.removeAttribute('aria-busy');
  button.disabled = false;
}
