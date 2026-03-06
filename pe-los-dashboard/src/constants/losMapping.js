// Maps LOS CATEGORY column values to dashboard buckets
export const LOS_BUCKETS = {
  // Revenue & Production Volumes
  'Oil':                        'oil',
  'Gas':                        'gas',
  'NGL':                        'ngl',

  // Variable Costs (oil)
  'Chemicals':                  'variable_oil',
  'Fuel & Power':               'variable_oil',

  // Variable Water
  'Liquids Hauling & Disposal': 'variable_water',

  // Fixed + WO
  'Company Labor':              'fixed',
  'Contract Labor/Pumper':      'fixed',
  'Field Office':               'fixed',
  'EHS & Regulatory':           'fixed',
  'Measurement/Automation':     'fixed',
  'Surface Repairs & Maint':    'fixed',
  'Vehicles':                   'fixed',
  'Well Servicing':             'fixed',

  // Production Taxes
  'Production Taxes-Oil':       'prod_taxes',
  'Production Taxes-Gas':       'prod_taxes',
  'Production Taxes-NGL':       'prod_taxes',

  // Excluded from LOS totals
  'CAPEX':                      'capex',
};

// Cost Category tags for fallback bucket lookup
export const COST_CATEGORY_BUCKETS = {
  'Fixed':  'fixed',
  'Var':    'variable_oil',
  'VW':     'variable_water',
  'RevO':   'oil',
  'RevG':   'gas',
  'RevNGL': 'ngl',
  'PTo':    'prod_taxes',
  'PTg':    'prod_taxes',
  'PTn':    'prod_taxes',
};

export const REVENUE_BUCKETS = new Set(['oil', 'gas', 'ngl']);
export const EXCLUDE_BUCKETS = new Set(['capex', null, undefined]);

export const CHART_COLORS = {
  oil:       '#4e9af1',
  gas:       '#f59e0b',
  ngl:       '#10b981',
  fixed:     '#6366f1',
  varOil:    '#f97316',
  varWater:  '#06b6d4',
  prodTaxes: '#a78bfa',
  revenue:   '#34d399',
  margin:    '#f472b6',
  myCase:    '#facc15',
  vdrCase:   '#94a3b8',
  cost:      '#e879f9',
};
