function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

function mergeRecord(slice, previous, incoming, incomingWins) {
  const winner = incomingWins ? incoming : previous;
  const other = incomingWins ? previous : incoming;
  if (slice === 'habits') {
    return {
      ...other,
      ...winner,
      completions: [...new Set([...(other.completions || []), ...(winner.completions || [])])],
      skipped: [...new Set([...(other.skipped || []), ...(winner.skipped || [])])],
    };
  }
  if (slice === 'tasks') {
    const winnerSubtasks = Array.isArray(winner.subtasks) ? winner.subtasks : [];
    const otherSubtasks = Array.isArray(other.subtasks) ? other.subtasks : [];
    const subtasks = new Map(winnerSubtasks.map((item, index) => [item.id || `index:${index}`, item]));
    otherSubtasks.forEach((item, index) => {
      const key = item.id || `index:${index}`;
      if (!subtasks.has(key)) subtasks.set(key, item);
    });
    return {
      ...other,
      ...winner,
      tags: [...new Set([...(winner.tags || []), ...(other.tags || [])])],
      focusSeconds: Math.max(other.focusSeconds || 0, winner.focusSeconds || 0),
      subtasks: [...subtasks.values()],
    };
  }
  return { ...other, ...winner };
}

function mergeRecords(slice, base, incoming, incomingWins) {
  const records = Array.isArray(base) ? base : [];
  const additions = Array.isArray(incoming) ? incoming : [];
  const merged = [];
  const indexes = new Map();
  [...records, ...additions].forEach((record, index) => {
    const key = record?.id == null ? `json:${JSON.stringify(record)}` : String(record.id);
    if (!indexes.has(key)) {
      indexes.set(key, merged.length);
      merged.push(record);
      return;
    }
    const targetIndex = indexes.get(key);
    const previous = merged[targetIndex];
    const fromIncoming = index >= records.length;
    merged[targetIndex] = mergeRecord(
      slice,
      previous,
      record,
      fromIncoming ? incomingWins : !incomingWins,
    );
  });
  return merged;
}

function mergeObject(base, incoming, incomingWins) {
  const result = { ...(base || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (!Object.hasOwn(result, key)) {
      result[key] = value;
      return;
    }
    if (result[key] && value && typeof result[key] === 'object' && typeof value === 'object'
      && !Array.isArray(result[key]) && !Array.isArray(value)) {
      result[key] = mergeObject(result[key], value, incomingWins);
      return;
    }
    if (incomingWins) result[key] = value;
  });
  return result;
}

function mergeSettings(base, incoming, defaults, incomingWins) {
  const mergeValue = (current, older, fallback) => {
    if (sameValue(current, fallback)) return clone(older);
    if (current && older && typeof current === 'object' && typeof older === 'object'
      && !Array.isArray(current) && !Array.isArray(older)) {
      const merged = { ...current };
      new Set([...Object.keys(current), ...Object.keys(older)]).forEach((key) => {
        merged[key] = mergeValue(current[key], older[key], fallback?.[key]);
      });
      return merged;
    }
    if (Array.isArray(current) && Array.isArray(older)) {
      if (sameValue(current, fallback)) return clone(older);
      if (sameValue(older, fallback)) return clone(current);
      return clone(incomingWins ? older : current);
    }
    if (sameValue(older, fallback)) return clone(current);
    return clone(incomingWins ? older : current);
  };

  const merged = mergeValue(base || {}, incoming || {}, defaults);
  const mergeNamed = (current, old, key) => {
    const items = new Map();
    const add = (list, overwrite) => (list || []).forEach((item) => {
      if (!item || typeof item[key] !== 'string') return;
      if (!items.has(item[key]) || overwrite) items.set(item[key], item);
    });
    if (incomingWins) {
      add(current, false);
      add(old, true);
    } else {
      add(old, false);
      add(current, true);
    }
    return [...items.values()];
  };

  merged.lists = mergeNamed(base?.lists, incoming?.lists, 'name');
  merged.cats = {
    out: mergeNamed(base?.cats?.out, incoming?.cats?.out, 'name'),
    in: mergeNamed(base?.cats?.in, incoming?.cats?.in, 'name'),
  };
  merged.prefs = { ...(merged.prefs || {}) };
  merged.prefs.trash = mergeRecords(
    'trash',
    base?.prefs?.trash || [],
    incoming?.prefs?.trash || [],
    incomingWins,
  );
  return merged;
}

function mergeSlice(base, incoming, slice, defaults, incomingWins) {
  if (slice === 'settings') return mergeSettings(base, incoming, defaults.settings, incomingWins);
  if (['tasks', 'habits', 'water', 'cycle', 'weight'].includes(slice)) {
    return mergeRecords(slice, base, incoming, incomingWins);
  }
  if (slice === 'gym') {
    return {
      templates: mergeRecords('gym.templates', base?.templates, incoming?.templates, incomingWins),
      logs: mergeRecords('gym.logs', base?.logs, incoming?.logs, incomingWins),
    };
  }
  if (slice === 'finance') {
    return {
      accounts: mergeRecords('finance.accounts', base?.accounts, incoming?.accounts, incomingWins),
      tx: mergeRecords('finance.tx', base?.tx, incoming?.tx, incomingWins),
      budgets: mergeObject(base?.budgets, incoming?.budgets, incomingWins),
      goals: mergeRecords('finance.goals', base?.goals, incoming?.goals, incomingWins),
      recurring: mergeRecords('finance.recurring', base?.recurring, incoming?.recurring, incomingWins),
    };
  }
  if (slice === 'cycleLog') return mergeObject(base, incoming, incomingWins);
  if (sameValue(base, defaults[slice])) return clone(incoming);
  if (sameValue(incoming, defaults[slice])) return clone(base);
  return clone(incomingWins ? incoming : base);
}

function stateCounts(state) {
  const habits = state.habits || [];
  const finance = state.finance || {};
  const gym = state.gym || {};
  return {
    tasks: state.tasks?.length || 0,
    habits: habits.length,
    habitLogs: habits.reduce((count, item) => count + (item.completions?.length || 0) + (item.skipped?.length || 0), 0),
    water: state.water?.length || 0,
    gym: (gym.templates?.length || 0) + (gym.logs?.length || 0),
    finance: (finance.accounts?.length || 0) + (finance.tx?.length || 0)
      + Object.keys(finance.budgets || {}).length + (finance.goals?.length || 0) + (finance.recurring?.length || 0),
    cycle: (state.cycle?.length || 0) + Object.keys(state.cycleLog || {}).length,
    weight: state.weight?.length || 0,
  };
}

function countAdded(current, merged) {
  const currentCounts = stateCounts(current);
  const mergedCounts = stateCounts(merged);
  return Object.fromEntries(Object.keys(currentCounts).map((key) => [
    key,
    Math.max(0, mergedCounts[key] - currentCounts[key]),
  ]));
}

export function prepareLegacyImport({ currentState, sources, defaults, normalizeSlice }) {
  const legacyState = clone(defaults);
  const orderedSources = [...sources].sort((a, b) => a.savedAt - b.savedAt);
  const presentSlices = new Set();
  for (const source of orderedSources) {
    const normalized = normalizeSlice(source.slice, source.value);
    if (normalized.invalidCount) {
      throw new Error(`A cópia antiga contém ${normalized.invalidCount} dado(s) inválido(s) em ${source.slice}. Nada foi importado; os originais foram preservados.`);
    }
    legacyState[source.slice] = mergeSlice(
      legacyState[source.slice],
      normalized.value,
      source.slice,
      defaults,
      true,
    );
    presentSlices.add(source.slice);
  }

  const mergedState = clone(currentState);
  presentSlices.forEach((slice) => {
    mergedState[slice] = mergeSlice(
      currentState[slice],
      legacyState[slice],
      slice,
      defaults,
      false,
    );
  });

  return {
    state: mergedState,
    found: stateCounts(legacyState),
    added: countAdded(currentState, mergedState),
    hasSettings: presentSlices.has('settings'),
    slices: [...presentSlices],
  };
}

function containsExpected(expected, actual) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && expected.every((item) => actual.some((candidate) => containsExpected(item, candidate)));
  }
  if (expected && typeof expected === 'object') {
    return actual && typeof actual === 'object' && !Array.isArray(actual)
      && Object.entries(expected).every(([key, value]) => containsExpected(value, actual[key]));
  }
  return Object.is(expected, actual);
}

export function hasAllExpectedRecords(expected, actual) {
  const slices = [
    'settings', 'tasks', 'pomodoro',
    'habits', 'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight',
  ];
  for (const slice of slices) {
    if (!containsExpected(expected?.[slice], actual?.[slice])) return slice;
  }
  return '';
}
