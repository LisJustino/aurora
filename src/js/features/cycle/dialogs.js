import { longDate } from '../../utils/dates.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

export function createCycleDialogViews(dependencies) {
  const {
    ui,
    CYC,
    CYC_ICON,
    CYC_OPTION_ICON,
    CYC_SHORT_LABEL,
    CYCLE_CONTRACEPTION_METHODS,
    CYCLE_TEST_RESULTS,
    cycLabel,
    dlgWrap,
    closeBtn,
    dlgField,
    today,
    MAX_CYCLE_PERIOD_DAYS,
  } = dependencies;
  return { log, period };

  function log() {
    const { day, log, quickFlow } = ui.dlg.d;
    const flow = CYC.find(({ id }) => id === 'flow');
    const groups = CYC.filter(({ id }) => id !== 'flow');
    const discharge = groups.find(({ id }) => id === 'discharge');
    const symptomGroups = groups.filter(({ id }) => id !== 'discharge');
    const orgasmOccurred = Object.hasOwn(log, 'orgasmOccurred')
      ? log.orgasmOccurred
      : Number.isInteger(log.orgasmCount)
        ? log.orgasmCount > 0
        : null;
    const intimacyHasRecord =
      Object.hasOwn(log, 'sexualActivity') ||
      Boolean(
        log.masturbationActivity ||
        log.sexToysUsed ||
        log.libido ||
        typeof orgasmOccurred === 'boolean' ||
        log.contraceptionMethods?.length,
      );
    const testsHaveRecord = Boolean(log.ovulationTestResult || log.pregnancyTestResult);
    const weightHasRecord = Number.isFinite(log.weightKg);
    const medicationHasRecord = typeof log.medicationTaken === 'boolean';
    const openGroups = ui.dlg.d.openGroups || [];
    const closedGroups = ui.dlg.d.closedGroups || [];
    const selectedSummaryPills = [];
    if (log.flow) selectedSummaryPills.push(`Fluxo: ${cycLabel('flow', log.flow)}`);
    for (const group of groups) {
      const value = log[group.id];
      if (group.single && value) {
        selectedSummaryPills.push(CYC_SHORT_LABEL[group.id]?.[value] || cycLabel(group.id, value));
      } else if (Array.isArray(value) && value.length) {
        for (const item of value) {
          selectedSummaryPills.push(CYC_SHORT_LABEL[group.id]?.[item] || cycLabel(group.id, item));
        }
      }
    }
    if (intimacyHasRecord) selectedSummaryPills.push('Intimidade');
    if (weightHasRecord) {
      selectedSummaryPills.push(
        `${log.weightKg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`,
      );
    }
    if (testsHaveRecord) selectedSummaryPills.push('Testes');
    if (medicationHasRecord) selectedSummaryPills.push(log.medicationTaken ? 'Medicação: tomei' : 'Medicação: não');
    if (log.note?.trim()) selectedSummaryPills.push('Anotação');
    const totalSelected = selectedSummaryPills.length;
    const formattedDate = (() => {
      const rawDate = longDate(day);
      return rawDate ? rawDate[0].toUpperCase() + rawDate.slice(1) : rawDate;
    })();
    const choiceStatus = (count) => `${count} selecionado${count === 1 ? '' : 's'}`;
    const choiceButton = (category, value, label, selected, id = '') => {
      return h`<button type="button" ${id ? raw(`id="${id}"`) : ''}
        class="chip cycle-choice${category === 'flow' ? ' cycle-flow-choice' : ''}" aria-label="${label}"
        title="${label}" aria-pressed="${selected ? 'true' : 'false'}" data-action="cyc-opt" data-c="${category}"
        data-category="${category}" data-v="${value}"><span class="cycle-choice-symbol"
        aria-hidden="true">${icon(CYC_OPTION_ICON[category]?.[value] || CYC_ICON[category], category === 'flow' ? { spot: 15, light: 18, medium: 20, heavy: 22 }[value] || 18 : 15)}</span><span
        class="cycle-choice-label">${CYC_SHORT_LABEL[category]?.[value] || label}</span><span class="cycle-choice-mark"
        aria-hidden="true">${icon('check', 12)}</span></button>`;
    };
    const symptomGroupView = (group) => {
      const current = group.single ? (log[group.id] ? [log[group.id]] : []) : log[group.id] || [];
      return h`<details class="sym cycle-symptom-group${current.length ? ' has-selection' : ''}"
        data-category="${group.id}" ${openGroups.includes(group.id) || (current.length && !closedGroups.includes(group.id)) ? raw('open') : ''}>
      <summary class="cycle-group-heading"><h3
        id="cycle-group-${group.id}"><span class="cycle-group-icon" aria-hidden="true">${icon(CYC_ICON[group.id], 15)}</span>${group.title}</h3><span
        class="cycle-group-meta">${
          current.length
            ? h`<span
        class="cycle-group-mode is-active">${choiceStatus(current.length)}</span>`
            : ''
        }<span
        class="cycle-disclosure-indicator" aria-hidden="true">${icon('chevDown', 15)}</span></span></summary>
      <div class="chips" role="group"
        aria-labelledby="cycle-group-${group.id}">${group.opts.map(([value, label]) => choiceButton(group.id, value, label, current.includes(value)))}</div>
    </details>`;
    };
    const testView = (key, title) => h`<section class="cycle-tracking-part" aria-labelledby="cycle-${key}-title">
    <h4 id="cycle-${key}-title">${title}</h4>
    <div class="cycle-intimacy-choices">
      <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${Boolean(log[key])}"
        data-action="cyc-test-toggle" data-k="${key}">${log[key] ? 'Teste feito' : 'Fiz este teste'}</button>
    </div>
    ${
      log[key]
        ? h`<div class="cycle-intimacy-choices" role="group"
      aria-label="Resultado: ${title}">${CYCLE_TEST_RESULTS.map(
        ([value, label]) => h`<button type="button"
      class="chip cycle-intimacy-choice" aria-pressed="${log[key] === value}" data-action="cyc-test-result"
      data-k="${key}" data-v="${value}">${label}</button>`,
      )}</div>`
        : ''
    }
  </section>`;
    return dlgWrap(
      h`<form id="dlgform" class="cycle-log-form" data-form="cycle-log">
    <div class="cycle-log-heading"><div class="cycle-log-heading-copy"><div class="cycle-log-eyebrow-row"><span
      class="cycle-log-eyebrow">${quickFlow ? 'Registro rápido' : 'Registro do dia'}</span>${
        totalSelected && !quickFlow
          ? h`<span class="cycle-log-count">${totalSelected} ${totalSelected === 1 ? 'selecionado' : 'selecionados'}</span>`
          : ''
      }</div><h2
      id="dt">${formattedDate}</h2><p>${quickFlow ? 'Escolha o fluxo deste dia. Os demais dados registrados serão mantidos.' : 'Anote só o que fizer sentido hoje. Todas as opções são opcionais.'}</p>${
        totalSelected && !quickFlow
          ? h`<div class="cycle-log-selected-strip" aria-label="Itens selecionados neste dia">${selectedSummaryPills
              .slice(0, 6)
              .map((pill) => h`<span class="cycle-log-selected-pill">${pill}</span>`)}${
              selectedSummaryPills.length > 6
                ? h`<span class="cycle-log-selected-pill is-more">+${selectedSummaryPills.length - 6}</span>`
                : ''
            }</div>`
          : ''
      }</div>${closeBtn}</div>
    <section class="cycle-flow-group${log.flow ? ' has-selection' : ''}" data-category="flow" role="group" aria-labelledby="cycle-flow-title">
      <div class="cycle-group-heading cycle-flow-heading"><div><h3
        id="cycle-flow-title"><span class="cycle-group-icon" aria-hidden="true">${icon(CYC_ICON.flow, 15)}</span>Fluxo menstrual</h3><p>Leve, médio ou intenso entram nas estimativas; escape, não.</p></div><span
        class="cycle-group-mode${log.flow ? ' is-active' : ''}">${log.flow ? cycLabel('flow', log.flow) : 'Opcional'}</span></div>
      <div class="chips" role="group"
        aria-label="Intensidade do fluxo">${flow.opts.map(([value, label], index) => choiceButton('flow', value, label, log.flow === value, index === 0 ? 'f0' : ''))}</div>
    </section>
    ${
      quickFlow
        ? ''
        : h`<div class="cycle-symptoms-heading"><h3
          id="cycle-symptoms-title">Sinais e bem-estar</h3><p>Abra apenas os temas que quiser anotar hoje.</p></div>
    <div class="cycle-symptom-grid" role="group"
      aria-labelledby="cycle-symptoms-title">${symptomGroups.map(symptomGroupView)}</div>
    <div class="cycle-section-divider"><span>Corpo e intimidade</span></div>
    <div class="cycle-intimacy-grid">
      ${symptomGroupView(discharge)}
      <details class="sym cycle-symptom-group cycle-intimacy-group${intimacyHasRecord ? ' has-selection' : ''}"
        data-category="intimacy" ${openGroups.includes('intimacy') || (intimacyHasRecord && !closedGroups.includes('intimacy')) ? raw('open') : ''}>
        <summary class="cycle-group-heading"><h3
          id="cycle-intimacy-title"><span class="cycle-group-icon" aria-hidden="true">${icon('heart', 15)}</span>Intimidade</h3><span
          class="cycle-group-meta">${
            intimacyHasRecord
              ? h`<span
          class="cycle-group-mode is-active">Registrado</span>`
              : ''
          }<span class="cycle-disclosure-indicator"
          aria-hidden="true">${icon('chevDown', 15)}</span></span></summary>
        <div class="cycle-intimacy-content" aria-labelledby="cycle-intimacy-title">
          <p class="cycle-intimacy-intro"
            id="cycle-intimacy-intro">Registre só o que quiser, sem detalhes. Cada opção é independente.</p>
          <section class="cycle-intimacy-part" aria-labelledby="cycle-intimacy-activity-title">
            <h4 id="cycle-intimacy-activity-title">Relação com outra pessoa</h4>
            <div class="cycle-intimacy-choices" role="group" aria-label="Atividade sexual com outra pessoa">
              <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${log.sexualActivity === true}"
                data-action="cyc-sex" data-v="yes">Houve relação</button>
              <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${log.sexualActivity === false}"
                data-action="cyc-sex" data-v="no">Não houve hoje</button>
            </div>
            <p class="cycle-intimacy-help">Sem seleção: não informado.</p>
          </section>
          ${
            log.sexualActivity === true
              ? h`<section class="cycle-intimacy-part cycle-intimacy-methods">
            <div><h4>Método contraceptivo</h4><p>Marque os que se aplicam. Contracepção não significa prevenção de ISTs; preservativos ajudam a reduzir esse risco.</p></div>
            <div class="chips cycle-contraception-options" role="group"
              aria-label="Métodos contraceptivos usados">${CYCLE_CONTRACEPTION_METHODS.map(
                ({ id, label }) => h`<button
              type="button" class="chip"
              aria-pressed="${(log.contraceptionMethods || []).includes(id) ? 'true' : 'false'}"
              data-action="cyc-method" data-v="${id}">${label}</button>`,
              )}</div>
          </section>`
              : ''
          }
          <section class="cycle-intimacy-part" aria-labelledby="cycle-libido-title">
            <h4 id="cycle-libido-title">Libido</h4>
            <div class="cycle-intimacy-choices" role="group" aria-label="Libido">
              <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${log.libido === 'high'}"
                data-action="cyc-libido" data-v="high">Alta</button>
              <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${log.libido === 'low'}"
                data-action="cyc-libido" data-v="low">Baixa</button>
            </div>
          </section>
          <section class="cycle-intimacy-part" aria-label="Outras atividades">
            <div class="cycle-intimacy-choices" role="group" aria-label="Atividades opcionais">
              <button type="button" class="chip cycle-intimacy-choice"
                aria-pressed="${Boolean(log.masturbationActivity)}" data-action="cyc-intimacy-toggle"
                data-k="masturbationActivity">Masturbação</button>
              <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${Boolean(log.sexToysUsed)}"
                data-action="cyc-intimacy-toggle" data-k="sexToysUsed">Brinquedos</button>
            </div>
          </section>
          <section class="cycle-intimacy-part" aria-labelledby="cycle-orgasm-title">
            <h4 id="cycle-orgasm-title">Orgasmo</h4>
            <div class="cycle-intimacy-choices" role="group" aria-label="Registro de orgasmo">
              <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${orgasmOccurred === true}"
                data-action="cyc-orgasm" data-v="yes">Houve</button>
              <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${orgasmOccurred === false}"
                data-action="cyc-orgasm" data-v="no">Não houve</button>
            </div>
          </section>
          <p class="cycle-intimacy-privacy">Os registros ficam na sua conta. Cópias do Aurora que você já baixou podem conter esses dados e não têm proteção própria por senha.</p>
        </div>
      </details>
    </div>
    <div class="cycle-section-divider"><span>Acompanhamento diário</span></div>
    <div class="cycle-daily-tracking-grid">
      <details class="sym cycle-symptom-group${weightHasRecord ? ' has-selection' : ''}"
        data-category="weight" ${openGroups.includes('weight') || (weightHasRecord && !closedGroups.includes('weight')) ? raw('open') : ''}>
        <summary class="cycle-group-heading"><h3
          id="cycle-weight-title"><span class="cycle-group-icon" aria-hidden="true">${icon('activity', 15)}</span>Peso</h3><span
          class="cycle-group-meta">${
            weightHasRecord
              ? h`<span
          class="cycle-group-mode is-active">${log.weightKg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</span>`
              : ''
          }<span
          class="cycle-disclosure-indicator" aria-hidden="true">${icon('chevDown', 15)}</span></span></summary>
        <div class="cycle-tracking-content" aria-labelledby="cycle-weight-title">
          <label class="f">Peso do dia <span class="cycle-weight-input"><input type="text" inputmode="decimal"
            autocomplete="off" maxlength="6" data-dlg="log.weightKg"
            value="${weightHasRecord ? log.weightKg.toFixed(1) : ''}" placeholder="Ex.: 65,5"
            aria-describedby="cycle-weight-help"><span aria-hidden="true">kg</span></span></label>
          <p class="cycle-tracking-help"
            id="cycle-weight-help">De 20 a 400 kg. O peso registrado mais recente por data atualiza o perfil e recalcula a meta de Beber água. Você pode ajustar a meta em Hábitos; um peso mais recente a recalcula.</p>
        </div>
      </details>
      <details class="sym cycle-symptom-group${testsHaveRecord ? ' has-selection' : ''}"
        data-category="tests" ${openGroups.includes('tests') || (testsHaveRecord && !closedGroups.includes('tests')) ? raw('open') : ''}>
        <summary class="cycle-group-heading"><h3
          id="cycle-tests-title"><span class="cycle-group-icon" aria-hidden="true">${icon('activity', 15)}</span>Testes</h3><span
          class="cycle-group-meta">${
            testsHaveRecord
              ? h`<span
          class="cycle-group-mode is-active">Registrado</span>`
              : ''
          }<span class="cycle-disclosure-indicator"
          aria-hidden="true">${icon('chevDown', 15)}</span></span></summary>
        <div class="cycle-tracking-content" aria-labelledby="cycle-tests-title">
          <p class="cycle-tracking-help">Marque se fez um teste; informar o resultado é opcional.</p>
          ${testView('ovulationTestResult', 'Teste de ovulação')}
          ${testView('pregnancyTestResult', 'Teste de gravidez')}
        </div>
      </details>
      <details class="sym cycle-symptom-group${medicationHasRecord ? ' has-selection' : ''}"
        data-category="medication" ${openGroups.includes('medication') || (medicationHasRecord && !closedGroups.includes('medication')) ? raw('open') : ''}>
        <summary class="cycle-group-heading"><h3
          id="cycle-medication-title"><span class="cycle-group-icon" aria-hidden="true">${icon('pill', 15)}</span>Medicação</h3><span
          class="cycle-group-meta">${
            medicationHasRecord
              ? h`<span
          class="cycle-group-mode is-active">${log.medicationTaken ? 'Tomei' : 'Não tomei'}</span>`
              : ''
          }<span class="cycle-disclosure-indicator"
          aria-hidden="true">${icon('chevDown', 15)}</span></span></summary>
        <div class="cycle-tracking-content" aria-labelledby="cycle-medication-title">
          <p class="cycle-tracking-help">Sem nome nem dose; registre apenas se tomou medicação hoje.</p>
          <div class="cycle-intimacy-choices" role="group" aria-label="Tomou medicação hoje">
            <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${log.medicationTaken === true}"
              data-action="cyc-medication" data-v="yes">Tomei</button>
            <button type="button" class="chip cycle-intimacy-choice" aria-pressed="${log.medicationTaken === false}"
              data-action="cyc-medication" data-v="no">Não tomei</button>
          </div>
        </div>
      </details>
    </div>
    <div class="cycle-note-block">
      ${dlgField(
        'Anotações do dia',
        h`<textarea data-dlg="log.note" maxlength="500" rows="3"
        placeholder="Algo que você queira lembrar sobre hoje…">${log.note || ''}</textarea>`,
        'full',
      )}
    </div>`
    }
  </form>`,
      h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit"
        class="btn primary" form="dlgform">${quickFlow ? 'Salvar fluxo' : 'Salvar registro'}</button>`,
    );
  }
  function period() {
    const { start, end, index } = ui.dlg.d;
    const maxDate = today();
    const editing = Number.isInteger(index);
    return dlgWrap(
      h`<form id="dlgform" class="cycle-period-form" data-form="cycle-period">
    <div class="cycle-log-heading"><div><span class="cycle-log-eyebrow">Registro do ciclo</span><h2
      id="dt">${editing ? 'Editar período' : 'Registrar período'}</h2><p>Informe o primeiro e o último dia para registrar o período inteiro de uma vez.</p></div>${closeBtn}</div>
    <div class="cycle-period-fields">
      ${dlgField(
        'Primeiro dia',
        h`<input id="f0" type="date" name="start" value="${start}" max="${maxDate}"
        aria-describedby="cycle-period-help" required>`,
      )}
      ${dlgField(
        'Último dia',
        h`<input type="date" name="end" value="${end}" max="${maxDate}"
        aria-describedby="cycle-period-help" required>`,
      )}
    </div>
    <p class="fine"
      id="cycle-period-help">O intervalo pode ter até ${MAX_CYCLE_PERIOD_DAYS} dias e não altera sintomas ou anotações já salvos. As estimativas podem mudar quando as datas forem atualizadas.</p>
  </form>`,
      h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit"
        class="btn primary" form="dlgform">${editing ? 'Atualizar período' : 'Salvar período'}</button>`,
    );
  }
}
