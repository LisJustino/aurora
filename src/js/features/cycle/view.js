import { addDays, DIAS, longDate, MESES_L, pad, pk, shortDate, today } from '../../utils/dates.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { emptyState } from '../../utils/empty-state.js';

export function renderCycleView({
  S, ui, gate, areaPageTitle, cycleStats, dayLog, cycleDayNumber,
  hasAnyLog, cyclePeriodEnd, cycleCalendarPhase, weekStartDay, clamp,
  plural, cycleLogSummary, CYC_ICON, cap, ymLabel,
}) {
  const g = gate('cycle', 'Ciclo');   if (g) return h`${areaPageTitle('ciclo', 'Ciclo')}${g}`;
  const tdy = today(), st = cycleStats(S.cycleLog, S.cycle, tdy), sel = ui.cycDay && ui.cycDay <= tdy ? ui.cycDay : tdy, log = dayLog(sel);
  const ym = ui.calMonth, [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), nDays = new Date(y, m, 0).getDate();
  const strip = Array.from({ length: 14 }, (_, i) => addDays(tdy, i - 13));
  const dn = cycleDayNumber(sel, st.starts);
  const hasCycleHistory = st.starts.length > 0;
  const hasCycleRecords = Object.values(S.cycleLog).some(hasAnyLog);
  const selectedPeriodIndex = S.cycle.findIndex((period) => period.start <= sel && cyclePeriodEnd(period) >= sel);
  const selectedPeriod = selectedPeriodIndex >= 0 ? S.cycle[selectedPeriodIndex] : null;
  const selectedPhase = cycleCalendarPhase(sel, st);
  const cycleMoment = st.set.has(sel)
    ? ['Período registrado', 'Este dia faz parte de um período que você registrou.']
    : st.next === sel
      ? ['Início estimado', 'Veja como as estimativas funcionam no calendário.']
      : selectedPhase === 'ovulation'
        ? ['Ovulação estimada', `Dia ${dn} do ciclo. A previsão pode variar e não serve como método contraceptivo.`]
        : selectedPhase === 'fertile'
          ? ['Janela fértil estimada', `Dia ${dn} do ciclo. A previsão pode variar e não serve como método contraceptivo.`]
      : dn
        ? [`Dia ${dn} do ciclo`, 'Fase não estimada para esta data.']
        : hasCycleHistory
          ? ['Sem ciclo iniciado nesta data', 'Selecione uma data a partir do início registrado para ver o dia do ciclo.']
          : ['Comece pelo primeiro registro', 'Marque o primeiro dia do fluxo menstrual. Com dois inícios registrados, você poderá ver médias e estimativas.'];
  const cells = []; for (let i = 0; i < (first.getDay() + 7 - weekStartDay()) % 7; i++) cells.push('<span></span>');
  for (let d = 1; d <= nDays; d++) {
    const k = `${ym}-${pad(d)}`, fut = k > tdy, phase = cycleCalendarPhase(k, st);
    const phaseLabel = phase === 'menstruation' ? 'menstruação registrada'
      : phase === 'fertile' ? 'janela fértil estimada'
        : phase === 'ovulation' ? 'ovulação estimada' : '';
    const phaseClass = phase ? `phase-${phase}` : '';
    cells.push(`<button type="button" class="${phaseClass} ${st.set.has(k) ? 'm' : st.next === k ? 'p' : ''} ${k === tdy ? 't' : ''} ${k === sel ? 's' : ''} ${hasAnyLog(S.cycleLog[k]) ? 'l' : ''}" ${fut ? 'disabled' : ''} data-action="cyc-day" data-d="${k}" aria-label="${d} de ${MESES_L[m - 1]}${phaseLabel ? ', ' + phaseLabel : st.next === k ? ', próximo início estimado' : ''}${hasAnyLog(S.cycleLog[k]) ? ', com registro' : ''}">${d}</button>`);
  }
  const cycleProgress = st.avg && dn ? clamp(Math.round(dn / st.avg * 100), 0, 100) : 0;
  const cycleRange = st.min === st.max ? `${st.min} dias` : `${st.min} a ${st.max} dias`;
  const cycleEstimateNotice = !st.avg
    ? 'Ainda não há registros suficientes para estimar fases do ciclo. As previsões não substituem avaliação profissional nem servem como método contraceptivo.'
    : st.canEstimateFertility
      ? 'Ovulação e janela fértil são estimativas que podem variar. As previsões não substituem avaliação profissional nem servem como método contraceptivo.'
      : st.hasOutOfRangeRecentInterval
        ? 'Há um intervalo recente fora da faixa de 15 a 60 dias usada nos cálculos; por isso, ovulação e janela fértil não são estimadas. As demais previsões não substituem avaliação profissional nem servem como método contraceptivo.'
        : `A variação dos últimos ${st.observedIntervals} intervalos foi de ${st.min} a ${st.max} dias; por isso, ovulação e janela fértil não são estimadas. As demais previsões não substituem avaliação profissional nem servem como método contraceptivo.`;
  return h`${areaPageTitle('ciclo', 'Ciclo')}
    <div class="notice cycle-consent-management" role="note"><span>Você pode retirar o consentimento quando quiser. Ciclo será bloqueado, mas os registros existentes continuarão na conta até serem apagados.</span><button type="button" class="btn back sm" data-action="cycle-consent-revoke" ${ui.cycleConsentBusy ? raw('disabled aria-busy="true"') : ''}>Retirar consentimento</button></div>
    ${!hasCycleHistory && !hasCycleRecords
      ? h`<section class="card cycle-start-empty">${emptyState({
        title: 'Seu ciclo começa no seu tempo.',
        description: 'Quando quiser, registre um período ou uma anotação. Você pode acompanhar sem pressa.',
        action: h`<button type="button" class="btn primary" data-action="cyc-period-open">${icon('calendar', 16)}Registrar primeiro período</button>`,
        iconName: 'calendar',
        headingLevel: 'h2',
      })}<div class="cycle-empty-actions"><button type="button" class="btn" data-action="cyc-start-today">${icon('plus', 16)}Começou hoje</button><button type="button" class="btn ghost" data-action="cyc-period-past">Período anterior</button></div></section>`
      : h`<section class="cycle-overview" aria-labelledby="cycle-overview-title"><header class="cycle-overview-head"><div><span>${hasCycleHistory ? 'Seu ciclo' : 'Primeiros passos'}</span><h2 id="cycle-overview-title">${cycleMoment[0]}<i>.</i></h2><p>${cycleMoment[1]}</p></div><div class="cycle-overview-actions"><button type="button" class="btn primary" data-action="cyc-start-today">${icon('plus', 16)}Começou hoje</button><button type="button" class="btn" data-action="cyc-period-open">${icon('calendar', 16)}Registrar período</button><button type="button" class="btn" data-action="cyc-period-past">Período anterior</button></div></header>${hasCycleHistory ? h`<div class="stats cycle-overview-stats">${dn ? h`<div class="cycle-day-ring ${st.avg ? '' : 'is-unestimated'}" ${st.avg ? `style="--cycle-progress:${cycleProgress}%"` : ''}><span><b>${dn}</b><small>Dia do ciclo</small></span></div>` : ''}${st.avg ? h`      <div class="stat"><b>${st.avg} dias</b><span>Média dos ${st.observedIntervals} ${plural(st.observedIntervals, 'intervalo recente', 'intervalos recentes')} · variação de ${cycleRange}</span></div><div class="stat"><b>${shortDate(st.next)}</b><span>Próximo início estimado</span></div>` : h`<p class="cycle-next-step">Registre o próximo início da menstruação para calcular a duração média e mostrar estimativas.</p>`}</div>` : ''}</section>`}
    <section class="card cycle-day-entry" aria-labelledby="cd"><div class="head"><div><h2 id="cd">${sel === tdy ? 'Hoje' : cap(longDate(sel))}<i>.</i></h2><p class="cycle-day-summary">${hasAnyLog(log) ? cycleLogSummary(log) : st.set.has(sel) ? 'Este dia faz parte de um período registrado. Se quiser, anote sintomas ou fluxo.' : hasCycleHistory ? 'Sem registro neste dia. Se quiser, anote sintomas ou fluxo.' : 'Ainda não há registro neste dia. Escolha uma data e registre o fluxo para começar.'}</p></div>${hasAnyLog(log) ? h`<button type="button" class="btn ghost sm" data-action="cyc-clear">Limpar o dia</button>` : ''}</div>
      ${selectedPeriod ? h`<div class="cycle-period-tools" aria-label="Período menstrual selecionado"><p><b>Período registrado:</b> ${longDate(selectedPeriod.start)}${cyclePeriodEnd(selectedPeriod) === selectedPeriod.start ? '' : ` a ${longDate(cyclePeriodEnd(selectedPeriod))}`}</p><div><button type="button" class="btn sm" data-action="cyc-period-edit" data-index="${selectedPeriodIndex}">Editar período</button><button type="button" class="btn danger sm" data-action="cyc-period-delete" data-index="${selectedPeriodIndex}">Excluir período</button></div></div>` : ''}
      <div class="cycle-day-tools"><button type="button" class="btn ghost sm" data-action="cyc-flow-open">${icon(CYC_ICON.flow, 16)}Registrar fluxo</button><button type="button" class="btn sm" data-action="cyc-open">${icon('pencil', 16)}Registrar este dia</button></div>
      <div class="scroll-x" role="group" aria-label="Escolher o dia">${strip.map((k) => h`<button type="button" class="dchip ${k === sel ? 'on' : ''} ${st.set.has(k) ? 'per' : ''}" data-action="cyc-day" data-d="${k}" aria-pressed="${k === sel}" aria-label="${longDate(k)}${st.set.has(k) ? ', período' : ''}${hasAnyLog(S.cycleLog[k]) ? ', com registro' : ''}"><span>${DIAS[pk(k).getDay()]}</span><b>${pk(k).getDate()}</b><i class="${hasAnyLog(S.cycleLog[k]) ? 'on' : ''}"></i></button>`)}</div></section>
    <section class="card cycle-calendar-card"><div class="head"><button class="ibtn" data-action="cal-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><div><p class="section-kicker">Calendário do ciclo</p><h2>${cap(ymLabel(ym))}</h2><p class="cycle-calendar-help">Selecione um dia. As cores indicam registros ou fases estimadas.</p></div><button class="ibtn" data-action="cal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
      <div class="cal">${raw(DIAS.map((d) => `<b>${d}</b>`).join('') + cells.join(''))}</div>
      <div class="cycle-calendar-legend" role="group" aria-label="Legenda das fases do calendário">
        <span><i class="lg m"></i>Menstruação registrada</span>
        ${st.canEstimateFertility ? h`<span><i class="lg fertile"></i>Janela fértil estimada</span><span><i class="lg ovulation"></i>Ovulação estimada</span>` : ''}
        ${st.next ? h`<span><i class="lg p"></i>Próximo início estimado</span>` : ''}
        <span><i class="lg l"></i>Dia com registro</span>
      </div>
      ${st.canEstimateFertility ? h`<p class="fine">Ovulação e janela fértil são estimativas e não servem como método contraceptivo.</p>` : ''}
      <details id="d-cycle-estimates" class="cycle-estimate-notice" ${ui.openDetails['cycle-estimates'] ? raw('open') : ''}>
        <summary>Como as estimativas funcionam ${icon('chevDown', 18)}</summary>
        <p>${cycleEstimateNotice}</p>
      </details></section>
    <details class="card cycle-health-card">
      <summary class="cycle-health-summary"><span><span class="cycle-health-eyebrow">Informação e cuidado</span><strong>Ciclo, sexualidade e prevenção</strong><small>Orientações gerais sobre mudanças do ciclo, contracepção, ISTs e quando buscar ajuda.</small></span>${icon('chevDown', 18)}</summary>
      <div class="cycle-health-content">
        <article class="cycle-health-topic">
          <h3>${icon('activity', 17)}O que pode explicar as mudanças?</h3>
          <p>Os níveis hormonais mudam ao longo do ciclo e podem acompanhar cólicas, sensibilidade nas mamas e variações de humor. A cólica costuma ocorrer porque o útero se contrai para eliminar seu revestimento. Estresse, mudanças de peso ou de exercício, gravidez e alguns métodos contraceptivos também podem alterar o padrão. Uma mudança isolada não confirma uma causa: registre quando acontece e converse com uma profissional de saúde se persistir ou preocupar.</p>
        </article>
        <article class="cycle-health-topic">
          <h3>${icon('heart', 17)}Relações, contracepção e ISTs</h3>
          <p>Ter relações durante a menstruação é uma escolha; conforto e consentimento importam. Menstruar não impede uma gravidez: a ovulação pode variar e espermatozoides podem permanecer viáveis por alguns dias. As previsões deste calendário não servem como método contraceptivo.</p>
          <p>Contracepção e prevenção de ISTs são cuidados distintos. Preservativos ajudam a reduzir o risco de ISTs, que podem ser transmitidas em qualquer fase do ciclo e nem sempre causam sinais. Para orientação, testagem ou atendimento após uma possível exposição, procure uma UBS.</p>
          <p>Sangramento entre menstruações ou depois da relação pode ter diferentes causas, inclusive contraceptivos, ressecamento ou infecções. Se for novo, recorrente ou vier com dor, procure avaliação — não dá para descobrir a causa apenas pelo aplicativo.</p>
        </article>
        <article class="cycle-health-topic">
          <h3>${icon('alert', 17)}Dor e sinais para buscar atendimento</h3>
          <p>Procure uma UBS ou ginecologista se a dor piorar, atrapalhar suas atividades, houver dor durante a relação, ao urinar ou evacuar, ou mudança persistente no fluxo ou intervalo. Dor pélvica muito forte, nova ou pior que o habitual merece avaliação urgente. Se houver possibilidade de gravidez ou atraso menstrual junto com sangramento fora do usual e dor abdominal, procure atendimento com urgência. Em emergência, ligue 192 (SAMU).</p>
        </article>
        <div class="cycle-health-sources" aria-label="Fontes de saúde">
          <span>Fontes:</span>
          <a href="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/i/ist" target="_blank" rel="noopener noreferrer">Ministério da Saúde · ISTs</a>
          <a href="https://www.nhs.uk/contraception/methods-of-contraception/natural-family-planning/" target="_blank" rel="noopener noreferrer">NHS · contracepção e fertilidade</a>
          <a href="https://www.nhs.uk/conditions/periods/period-problems/" target="_blank" rel="noopener noreferrer">NHS · alterações menstruais</a>
          <a href="https://www.nhs.uk/symptoms/period-pain/" target="_blank" rel="noopener noreferrer">NHS · dor menstrual</a>
          <a href="https://www.nhs.uk/symptoms/vaginal-bleeding-between-periods-or-after-sex/" target="_blank" rel="noopener noreferrer">NHS · sangramento fora do período ou após sexo</a>
          <a href="https://www.gov.br/saude/pt-br/composicao/saes/samu-192" target="_blank" rel="noopener noreferrer">Ministério da Saúde · SAMU 192</a>
        </div>
      </div>
    </details>
    `;
}
