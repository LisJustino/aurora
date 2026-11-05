import { longDate } from '../../utils/dates.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

export function createCycleDialogViews(dependencies) {
  const {
    ui, CYC, CYC_ICON, CYC_OPTION_ICON, CYC_SHORT_LABEL, CYCLE_CONTRACEPTION_METHODS, topSymptoms, plural,
    cycLabel, dlgWrap, closeBtn, dlgField, today, MAX_CYCLE_PERIOD_DAYS,
  } = dependencies;
  return { log, period };

function log() {
  const { day, log, quickFlow } = ui.dlg.d;
  const flow = CYC.find(({ id }) => id === 'flow');
  const groups = CYC.filter(({ id }) => id !== 'flow');
  const frequentSymptoms = topSymptoms();
  const choiceStatus = (count, single) => count
    ? `${count} selecionado${count === 1 ? '' : 's'}`
    : `Opcional · ${single ? 'Escolha 1' : 'várias opções'}`;
  const choiceButton = (category, value, label, selected, id = '', count = 0) => {
    const accessibleLabel = count ? `${label}, registrado ${count} ${plural(count, 'dia', 'dias')} nos últimos 90 dias` : label;
    return h`<button type="button" ${id ? raw(`id="${id}"`) : ''} class="chip cycle-choice${category === 'flow' ? ' cycle-flow-choice' : ''}" aria-label="${accessibleLabel}" title="${accessibleLabel}" aria-pressed="${selected ? 'true' : 'false'}" data-action="cyc-opt" data-c="${category}" data-category="${category}" data-v="${value}"><span class="cycle-choice-symbol" aria-hidden="true">${icon(CYC_OPTION_ICON[category]?.[value] || CYC_ICON[category], category === 'flow' ? ({ spot: 14, light: 18, medium: 21, heavy: 24 }[value] || 18) : 18)}</span><span class="cycle-choice-label">${CYC_SHORT_LABEL[category]?.[value] || label}${count ? h`<small class="cycle-choice-frequency">${count} ${plural(count, 'dia', 'dias')}</small>` : ''}</span><span class="cycle-choice-mark" aria-hidden="true">${icon('check', 14)}</span></button>`;
  };
  return dlgWrap(h`<form id="dlgform" class="cycle-log-form" data-form="cycle-log">
    <div class="cycle-log-heading"><div><span class="cycle-log-eyebrow">${quickFlow ? 'Registro rápido' : 'Registro do ciclo'}</span><h2 id="dt">${longDate(day)}</h2><p>${quickFlow ? 'Escolha o fluxo deste dia. Os demais dados registrados serão mantidos.' : 'Registre só o que fizer sentido. Abra as categorias para ver as opções; tudo é opcional.'}</p></div>${closeBtn}</div>
    <section class="cycle-flow-group" data-category="flow" role="group" aria-labelledby="cycle-flow-title">
      <div class="cycle-group-heading"><div><h3 id="cycle-flow-title">${icon(CYC_ICON.flow, 16)}Fluxo menstrual</h3><p>Leve, médio ou intenso entram nas estimativas; escape, não.</p></div><span class="cycle-group-mode">${log.flow ? `Selecionado: ${cycLabel('flow', log.flow)}` : 'Opcional · escolha 1'}</span></div>
      <div class="chips" role="group" aria-label="Intensidade do fluxo">${flow.opts.map(([value, label], index) => choiceButton('flow', value, label, log.flow === value, index === 0 ? 'f0' : ''))}</div>
    </section>
    ${quickFlow ? '' : h`<div class="cycle-symptoms-heading"><h3 id="cycle-symptoms-title">Sintomas e sinais</h3><p>Múltipla escolha, exceto em energia, sono e corrimento.</p></div>
    ${frequentSymptoms.length ? h`<section class="cycle-frequent" aria-label="Atalhos para sintomas frequentes"><div><h3>Seus mais frequentes</h3><p>Nos últimos 90 dias · toque para marcar ou desmarcar</p></div><div class="cycle-frequent-options">${frequentSymptoms.map(({ category, value, label, count }) => {
      const definition = CYC.find((item) => item.id === category);
      const selected = definition?.single ? log[category] === value : (log[category] || []).includes(value);
      return choiceButton(category, value, label, selected, '', count);
    })}</div></section>` : ''}
    <div class="cycle-symptom-grid" role="group" aria-labelledby="cycle-symptoms-title">${groups.map((group) => {
      const current = group.single ? (log[group.id] ? [log[group.id]] : []) : (log[group.id] || []);
      const openGroups = ui.dlg.d.openGroups || [];
      const closedGroups = ui.dlg.d.closedGroups || [];
      return h`<details class="sym cycle-symptom-group" data-category="${group.id}" ${openGroups.includes(group.id) || (current.length && !closedGroups.includes(group.id)) ? raw('open') : ''}>
        <summary class="cycle-group-heading"><h3 id="cycle-group-${group.id}">${icon(CYC_ICON[group.id], 16)}${group.title}</h3><span class="cycle-group-mode">${current.length ? choiceStatus(current.length, group.single) : 'Toque para escolher'}</span><span class="cycle-disclosure-indicator" aria-hidden="true">${icon('chevDown', 16)}</span></summary>
        <div class="chips" role="group" aria-labelledby="cycle-group-${group.id}">${group.opts.map(([value, label]) => choiceButton(group.id, value, label, current.includes(value)))}</div>
      </details>`;
    })}</div>
    ${dlgField('Anotações do dia', h`<textarea data-dlg="log.note" maxlength="500" rows="3" placeholder="Algo que você queira lembrar…">${log.note || ''}</textarea>`, 'full')}
    <section class="cycle-sexual-group" role="group" aria-labelledby="cycle-sexual-title">
      <h3 id="cycle-sexual-title">${icon('heart', 16)}Atividade sexual e orgasmos</h3>
      <p class="fine">Tudo é opcional. Registre separadamente atividade com outra pessoa e masturbação; métodos contraceptivos se aplicam somente à atividade com outra pessoa.</p>
      <label class="row cycle-sexual-toggle"><input type="checkbox" data-dlg="log.sexualActivity" aria-describedby="cycle-sexual-note" ${log.sexualActivity ? raw('checked') : ''}><span>Houve atividade sexual com outra pessoa neste dia</span></label>
      <p class="fine" id="cycle-sexual-note">Ao marcar, você pode registrar os métodos contraceptivos usados.</p>
      <label class="row cycle-sexual-toggle"><input type="checkbox" data-dlg="log.masturbationActivity" ${log.masturbationActivity ? raw('checked') : ''}><span>Houve masturbação neste dia</span></label>
      ${log.sexualActivity ? h`<p class="fine">Você pode selecionar mais de um método. “Nenhum método” e “Prefiro não informar” são opções exclusivas.</p>
        <div class="chips cycle-contraception-options" role="group" aria-label="Métodos contraceptivos usados">${CYCLE_CONTRACEPTION_METHODS.map(({ id, label }) => h`<button type="button" class="chip" aria-pressed="${(log.contraceptionMethods || []).includes(id) ? 'true' : 'false'}" data-action="cyc-method" data-v="${id}">${label}</button>`)}</div>
      ` : ''}
      ${dlgField('Orgasmos neste dia (opcional)', h`<input type="number" data-dlg="log.orgasmCount" min="0" max="99" step="1" value="${log.orgasmCount ?? ''}" inputmode="numeric" aria-describedby="cycle-orgasm-help">`, 'full')}
      <p class="fine" id="cycle-orgasm-help">Deixe em branco se preferir não registrar. Use 0 se não houve orgasmo (até 99 por dia).</p>
      <p class="fine">Os registros ficam na conta Aurora. O arquivo de backup não tem proteção própria por senha e pode incluir essas informações; guarde-o em um local privado.</p>
    </section>`}
  </form>`,
  h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit" class="btn primary" form="dlgform">${quickFlow ? 'Salvar fluxo' : 'Salvar registro'}</button>`);
}
function period() {
  const { start, end, index } = ui.dlg.d;
  const maxDate = today();
  const editing = Number.isInteger(index);
  return dlgWrap(h`<form id="dlgform" class="cycle-period-form" data-form="cycle-period">
    <div class="cycle-log-heading"><div><span class="cycle-log-eyebrow">Registro do ciclo</span><h2 id="dt">${editing ? 'Editar período' : 'Registrar período'}<i>.</i></h2><p>Informe o primeiro e o último dia para registrar o período inteiro de uma vez.</p></div>${closeBtn}</div>
    <div class="cycle-period-fields">
      ${dlgField('Primeiro dia', h`<input id="f0" type="date" name="start" value="${start}" max="${maxDate}" aria-describedby="cycle-period-help" required>`)}
      ${dlgField('Último dia', h`<input type="date" name="end" value="${end}" max="${maxDate}" aria-describedby="cycle-period-help" required>`)}
    </div>
    <p class="fine" id="cycle-period-help">O intervalo pode ter até ${MAX_CYCLE_PERIOD_DAYS} dias e não altera sintomas ou anotações já salvos. As estimativas podem mudar quando as datas forem atualizadas.</p>
  </form>`,
  h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit" class="btn primary" form="dlgform">${editing ? 'Atualizar período' : 'Salvar período'}</button>`);
}
}
