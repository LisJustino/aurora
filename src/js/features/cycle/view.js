import { addDays, dayDiff, DIAS, longDate, MESES_L, pad, pk, shortDate, today } from '../../utils/dates.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { emptyState } from '../../utils/empty-state.js';
import { cycleHistory, nextPeriodRange, periodDelay, symptomPhasePatterns } from './calculations.js';

export function renderCycleView({
  S, ui, gate, areaPageTitle, cycleStats, dayLog, cycleDayNumber,
  hasAnyLog, cyclePeriodEnd, cycleCalendarPhase, topSymptoms, cycLabel, weekStartDay, clamp,
  plural, cycleLogSummary, CYC_ICON, cap, ymLabel,
}) {
  const g = gate('cycle', 'Ciclo');   if (g) return h`${areaPageTitle('ciclo', 'Ciclo')}${g}`;
  const tdy = today(), st = cycleStats(S.cycleLog, S.cycle, tdy), sel = ui.cycDay && ui.cycDay <= tdy ? ui.cycDay : tdy, log = dayLog(sel);
  const recentSymptoms = topSymptoms(S.cycleLog, tdy, cycLabel);
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
  const hasPastEstimate = Boolean(st.next && st.next < tdy);
  const cells = []; for (let i = 0; i < (first.getDay() + 7 - weekStartDay()) % 7; i++) cells.push('<span></span>');
  for (let d = 1; d <= nDays; d++) {
    const k = `${ym}-${pad(d)}`, fut = k > tdy, phase = cycleCalendarPhase(k, st);
    const isUpcomingEstimate = st.next === k && !hasPastEstimate;
    const phaseLabel = phase === 'menstruation' ? 'menstruação registrada'
      : phase === 'fertile' ? 'janela fértil estimada'
        : phase === 'ovulation' ? 'ovulação estimada' : '';
    const phaseClass = phase ? `phase-${phase}` : '';
    cells.push(`<button type="button" class="${phaseClass} ${st.set.has(k) ? 'm' : isUpcomingEstimate ? 'p' : ''} ${k === tdy ? 't' : ''} ${k === sel ? 's' : ''} ${hasAnyLog(S.cycleLog[k]) ? 'l' : ''}" ${fut ? 'disabled' : ''} data-action="cyc-day" data-d="${k}" aria-label="${d} de ${MESES_L[m - 1]}${phaseLabel ? ', ' + phaseLabel : isUpcomingEstimate ? ', próximo início estimado' : ''}${hasAnyLog(S.cycleLog[k]) ? ', com registro' : ''}">${d}</button>`);
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
  const pastEstimateNotice = hasPastEstimate
    ? 'A data estimada já passou. Registre o próximo início quando acontecer para atualizar as previsões.'
    : '';
  const discreet = Boolean(S.settings?.prefs?.cycleDiscreet);
  const range = nextPeriodRange(st);
  const delay = hasCycleHistory ? periodDelay(st, tdy) : null;
  const startSoon = Boolean(range && !delay && !st.set.has(tdy)
    && tdy >= addDays(range.from, -3) && tdy <= range.to);
  const rangeText = range && !range.single ? `entre ${shortDate(range.from)} e ${shortDate(range.to)}` : range ? `em ${shortDate(range.from)}` : '';
  const history = cycleHistory(st.starts, st.set, 6);
  const completedCycles = history.filter((row) => row.length);
  const longestCycle = Math.max(1, ...completedCycles.map((row) => row.length));
  const patterns = symptomPhasePatterns(S.cycleLog, st, tdy, cycLabel);
  const quickSymptoms = recentSymptoms.filter((item) => ['pain', 'mood', 'digestion', 'skin'].includes(item.category)).slice(0, 4);
  const medicationInUse = Object.entries(S.cycleLog).some(([day, entry]) => day >= addDays(tdy, -14) && typeof entry?.medicationTaken === 'boolean');
  const privacyToggle = h`<button type="button" class="ibtn cycle-discreet-toggle" data-action="cycle-discreet-toggle" aria-pressed="${String(discreet)}" aria-label="${discreet ? 'Mostrar informações do Ciclo' : 'Ocultar informações do Ciclo'}" title="${discreet ? 'Mostrar informações' : 'Modo discreto'}">${icon(discreet ? 'eyeOff' : 'eye', 18)}</button>`;
  return h`${areaPageTitle('ciclo', 'Ciclo', privacyToggle)}
    ${discreet ? h`<p class="notice cycle-discreet-note" role="status">${icon('eyeOff', 16)}<span>Modo discreto ativado: as informações do Ciclo ficam ocultas. Toque no olho para mostrar.</span></p>` : ''}
    <div class="cycle-content${discreet ? ' is-discreet' : ''}" ${discreet ? raw('aria-hidden="true" inert') : ''}>
    ${!hasCycleHistory && !hasCycleRecords
      ? h`<section class="surface-open cycle-start-empty">${emptyState({
        title: 'Seu ciclo começa no seu tempo.',
        description: 'Quando quiser, registre um período ou uma anotação. Você pode acompanhar sem pressa.',
        action: h`<button type="button" class="btn primary" data-action="cyc-period-open">${icon('calendar', 16)}Registrar primeiro período</button>`,
        iconName: 'calendar',
        headingLevel: 'h2',
      })}<div class="cycle-empty-actions"><button type="button" class="btn" data-action="cyc-start-today">${icon('plus', 16)}Começou hoje</button><button type="button" class="btn ghost" data-action="cyc-period-past">Período anterior</button></div></section>`
      : h`<section class="cycle-overview" aria-labelledby="cycle-overview-title"><header class="cycle-overview-head"><div><span>${hasCycleHistory ? 'Seu ciclo' : 'Primeiros passos'}</span><h2 id="cycle-overview-title">${cycleMoment[0]}</h2><p>${cycleMoment[1]}</p></div><div class="cycle-overview-actions"><button type="button" class="btn primary" data-action="cyc-start-today">${icon('plus', 16)}Começou hoje</button><button type="button" class="btn" data-action="cyc-period-open">${icon('calendar', 16)}Registrar período</button><button type="button" class="btn" data-action="cyc-period-past">Período anterior</button></div></header>${hasCycleHistory ? h`<div class="stats cycle-overview-stats">${dn ? h`<div class="cycle-day-ring ${st.avg ? '' : 'is-unestimated'}" ${st.avg ? `style="--cycle-progress:${cycleProgress}%"` : ''}><span><b>${dn}</b><small>Dia do ciclo</small></span></div>` : ''}${st.avg ? h`      <div class="stat"><b>${st.avg} dias</b><span>Média dos ${st.observedIntervals} ${plural(st.observedIntervals, 'intervalo recente', 'intervalos recentes')} · variação de ${cycleRange}</span></div><div class="stat"><b>${range && !range.single ? `${shortDate(range.from)} a ${shortDate(range.to)}` : shortDate(st.next)}</b><span>${hasPastEstimate ? 'Data estimada já passou' : 'Próximo início estimado'}</span></div>` : h`<p class="cycle-next-step">Registre o próximo início da menstruação para calcular a duração média e mostrar estimativas.</p>`}</div>` : ''}</section>`}
    ${delay ? h`<aside class="notice cycle-delay-note" role="status">${icon('alert', 18)}<span><b>Passaram ${delay.days} ${plural(delay.days, 'dia', 'dias')} da data estimada.</b> ${delay.insideRange ? `Ainda está dentro da variação dos seus ciclos (até ${shortDate(range.to)}). Registre quando começar.` : 'Atrasos podem ter várias causas. Se continuar, ou se houver chance de gravidez, converse com um profissional de saúde.'}</span></aside>` : startSoon ? h`<aside class="notice cycle-soon-note" role="status">${icon('calendar', 18)}<span>Seu início deve acontecer ${rangeText}. As previsões podem variar.</span></aside>` : ''}
    <section class="surface-open cycle-day-entry" aria-labelledby="cd"><div class="head"><div><h2 id="cd">${sel === tdy ? 'Hoje' : cap(longDate(sel))}</h2><p class="cycle-day-summary">${hasAnyLog(log) ? cycleLogSummary(log) : st.set.has(sel) ? 'Este dia faz parte de um período registrado. Se quiser, anote sintomas ou fluxo.' : hasCycleHistory ? 'Sem registro neste dia. Se quiser, anote sintomas ou fluxo.' : 'Ainda não há registro neste dia. Escolha uma data e registre o fluxo para começar.'}</p></div>${hasAnyLog(log) ? h`<button type="button" class="btn ghost sm" data-action="cyc-clear">Limpar o dia</button>` : ''}</div>
      ${selectedPeriod ? h`<div class="cycle-period-tools" aria-label="Período menstrual selecionado"><p><b>Período registrado:</b> ${longDate(selectedPeriod.start)}${cyclePeriodEnd(selectedPeriod) === selectedPeriod.start ? '' : ` a ${longDate(cyclePeriodEnd(selectedPeriod))}`}</p><div><button type="button" class="btn sm" data-action="cyc-period-edit" data-index="${selectedPeriodIndex}">Editar período</button><button type="button" class="btn danger sm" data-action="cyc-period-delete" data-index="${selectedPeriodIndex}">Excluir período</button></div></div>` : ''}
      <div class="cycle-day-tools"><button type="button" class="btn ghost sm" data-action="cyc-flow-open">${icon(CYC_ICON.flow, 16)}Registrar fluxo</button><button type="button" class="btn sm" data-action="cyc-open">${icon('pencil', 16)}Registrar este dia</button></div>
      ${sel === tdy && medicationInUse && typeof log.medicationTaken !== 'boolean' ? h`<div class="cycle-med-reminder" role="group" aria-label="Medicação de hoje"><span class="small">Medicação de hoje ainda sem registro.</span><button type="button" class="btn sm" data-action="cyc-med-quick" data-v="yes">Tomei</button><button type="button" class="btn ghost sm" data-action="cyc-med-quick" data-v="no">Não tomei</button></div>` : ''}
      ${quickSymptoms.length ? h`<div class="cycle-quick" role="group" aria-label="Registro rápido para este dia"><span class="small muted">Registro rápido</span>${quickSymptoms.map((item) => h`<button type="button" class="chip" data-action="cyc-quick" data-c="${item.category}" data-v="${item.value}" aria-pressed="${String((log[item.category] || []).includes(item.value))}">${item.label}</button>`)}</div>` : ''}
      <div class="scroll-x" role="group" aria-label="Escolher o dia">${strip.map((k) => h`<button type="button" class="dchip ${k === sel ? 'on' : ''} ${st.set.has(k) ? 'per' : ''}" data-action="cyc-day" data-d="${k}" aria-pressed="${k === sel}" aria-label="${longDate(k)}${st.set.has(k) ? ', período' : ''}${hasAnyLog(S.cycleLog[k]) ? ', com registro' : ''}"><span>${DIAS[pk(k).getDay()]}</span><b>${pk(k).getDate()}</b><i class="${hasAnyLog(S.cycleLog[k]) ? 'on' : ''}"></i></button>`)}</div></section>
    <section class="surface-open cycle-calendar-card"><div class="head"><button class="ibtn" data-action="cal-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><div><p class="section-kicker">Calendário do ciclo</p><h2>${cap(ymLabel(ym))}</h2><p class="cycle-calendar-help">Selecione um dia. As cores indicam registros ou fases estimadas.</p></div><button class="ibtn" data-action="cal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
      <div class="cal">${raw(DIAS.map((d) => `<b>${d}</b>`).join('') + cells.join(''))}</div>
      <div class="cycle-calendar-legend" role="group" aria-label="Legenda das fases do calendário">
        <span><i class="lg m"></i>Menstruação registrada</span>
        ${st.canEstimateFertility ? h`<span><i class="lg fertile"></i>Janela fértil estimada</span><span><i class="lg ovulation"></i>Ovulação estimada</span>` : ''}
        ${st.next && !hasPastEstimate ? h`<span><i class="lg p"></i>Próximo início estimado</span>` : ''}
        <span><i class="lg l"></i>Dia com registro</span>
      </div>
      ${st.canEstimateFertility ? h`<p class="fine">Ovulação e janela fértil são estimativas e não servem como método contraceptivo.</p>` : ''}
      <details id="d-cycle-estimates" class="cycle-estimate-notice" ${ui.openDetails['cycle-estimates'] ? raw('open') : ''}>
        <summary>Como as estimativas funcionam ${icon('chevDown', 18)}</summary>
        <p>${cycleEstimateNotice}${pastEstimateNotice ? ` ${pastEstimateNotice}` : ''}</p>
      </details></section>
    ${hasCycleHistory ? h`<details class="card cycle-history" id="d-cycle-history" ${ui.openDetails['cycle-history'] ? raw('open') : ''}>
      <summary>Histórico dos ciclos ${icon('chevDown', 18)}</summary>
      <ul class="list cycle-history-list">${history.map((row) => h`<li><span class="cycle-history-date">${shortDate(row.start)}</span><span class="cycle-history-bar" aria-hidden="true">${row.length ? h`<i style="width:${Math.round(row.length / longestCycle * 100)}%"></i>` : ''}</span><b>${row.length ? `${row.length} dias` : 'em andamento'}</b><small>${row.periodLength ? `período de ${row.periodLength} ${plural(row.periodLength, 'dia', 'dias')}` : ''}</small></li>`)}</ul>
      ${completedCycles.length ? '' : h`<p class="small muted">Com dois inícios registrados, a duração de cada ciclo aparece aqui.</p>`}
      <button type="button" class="btn sm" data-action="cyc-report-open">${icon('list', 16)}Resumo para consulta</button>
    </details>` : ''}
    ${patterns.length ? h`<details class="card cycle-patterns" id="d-cycle-patterns" ${ui.openDetails['cycle-patterns'] ? raw('open') : ''}>
      <summary>Padrões nos seus registros ${icon('chevDown', 18)}</summary>
      <p class="small muted">Sintomas que, nos seus registros do último ano, aparecem mais em uma fase. Isso pode refletir quando você costuma registrar e não indica causa nem diagnóstico.</p>
      <ul class="list">${patterns.map((item) => h`<li><span>${item.label}</span><b>${item.inBucket} de ${item.count} ${item.bucket === 'period' ? 'durante o período' : 'nos 5 dias antes'}</b></li>`)}</ul>
    </details>` : ''}
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
          <a href="https://bvsms.saude.gov.br/bvs/publicacoes/saude_sexual_saude_reprodutiva.pdf" target="_blank" rel="noopener noreferrer">Ministério da Saúde · contracepção e fertilidade</a>
          <a href="https://www.febrasgo.org.br/noticia/menstruacao-e-ovulacao-tem-tudo-a-ver-sim/" target="_blank" rel="noopener noreferrer">FEBRASGO · variações menstruais</a>
          <a href="https://www.febrasgo.org.br/noticia/sentir-dor-abdominal-intensa-durante-o-periodo-menstrual-nao-e-normal/" target="_blank" rel="noopener noreferrer">FEBRASGO · dor menstrual</a>
          <a href="https://www.febrasgo.org.br/noticia/cancer-do-colo-do-utero-nao-espere-os-sintomas-eles-nem-sempre-aparecem/" target="_blank" rel="noopener noreferrer">FEBRASGO · sangramento fora do período ou após sexo</a>
          <a href="https://www.gov.br/saude/pt-br/composicao/saes/samu-192" target="_blank" rel="noopener noreferrer">Ministério da Saúde · SAMU 192</a>
        </div>
      </div>
    </details>
    <details class="notice cycle-consent-management">
      <summary>Privacidade do Ciclo</summary>
      <div class="cycle-consent-management-content">
        <span>Você pode retirar o consentimento quando quiser. Isso bloqueia Ciclo, mas não apaga registros. Antes de retirar, pode mover períodos e registros diários para a lixeira por 30 dias. O peso do Perfil e a meta de água dos Hábitos são compartilhados e serão mantidos.</span>
        <button type="button" class="btn danger sm" data-action="cycle-clear-all" ${S.cycle.length || Object.keys(S.cycleLog).length ? '' : raw('disabled')}>Mover registros para a lixeira</button>
        <button type="button" class="btn back sm" data-action="cycle-consent-revoke" ${ui.cycleConsentBusy ? raw('disabled aria-busy="true"') : ''}>Retirar consentimento</button>
      </div>
    </details>
    </div>
    `;
}
