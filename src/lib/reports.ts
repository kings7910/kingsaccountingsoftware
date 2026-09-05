export type ReportRow = {
  label: string;
  current: number;
  previous?: number;
  emphasis?: "subtotal" | "total";
  format?: "currency" | "number" | "percent";
};

export type ReportDefinition = {
  id: string;
  name: string;
  description: string;
  rows: ReportRow[];
  unavailableReason?: string;
};

export const reports: ReportDefinition[] = [
  { id:"profit-loss", name:"Profit & loss", description:"Revenue, operating costs, and net income.", rows:[
    {label:"Freight revenue",current:176470,previous:149820},{label:"Other income",current:8450,previous:7310},{label:"Total income",current:184920,previous:157130,emphasis:"subtotal"},
    {label:"Fuel",current:31284,previous:29410},{label:"Driver pay",current:42760,previous:38120},{label:"Repairs & maintenance",current:12380,previous:10840},{label:"Insurance",current:8820,previous:8340},{label:"Other operating expenses",current:24236,previous:22610},{label:"Total expenses",current:119480,previous:109320,emphasis:"subtotal"},{label:"Net profit",current:65440,previous:47810,emphasis:"total"},
  ]},
  { id:"balance-sheet", name:"Balance sheet", description:"What the company owns and owes.", rows:[{label:"Cash",current:98240,previous:77410},{label:"Accounts receivable",current:42360,previous:35180},{label:"Equipment, net",current:418500,previous:431200},{label:"Total assets",current:559100,previous:543790,emphasis:"subtotal"},{label:"Accounts payable",current:28750,previous:31220},{label:"Equipment loans",current:246800,previous:258400},{label:"Total liabilities",current:275550,previous:289620,emphasis:"subtotal"},{label:"Owner’s equity",current:283550,previous:254170,emphasis:"total"}]},
  { id:"cash-flow", name:"Cash flow", description:"Cash generated and used by the business.", rows:[{label:"Operating activities",current:72840,previous:53620},{label:"Equipment purchases",current:-18500,previous:-8400},{label:"Loan principal payments",current:-11600,previous:-11200},{label:"Owner distributions",current:-9000,previous:-7500},{label:"Net change in cash",current:33740,previous:26520,emphasis:"total"}]},
  { id:"general-ledger", name:"General ledger", description:"Posted activity across all accounts.", rows:[{label:"Cash entries",current:286,previous:251,format:"number"},{label:"Revenue entries",current:94,previous:81,format:"number"},{label:"Expense entries",current:173,previous:160,format:"number"},{label:"Adjusting entries",current:8,previous:6,format:"number"},{label:"Total posted entries",current:561,previous:498,format:"number",emphasis:"total"}]},
  { id:"trial-balance", name:"Trial balance", description:"Debit and credit balance verification.", rows:[{label:"Total debits",current:842650,previous:791220},{label:"Total credits",current:842650,previous:791220},{label:"Difference",current:0,previous:0,emphasis:"total"}]},
  { id:"ar-aging", name:"A/R aging", description:"Outstanding customer balances by age.", rows:[{label:"Current",current:28420,previous:24680},{label:"1–30 days",current:8120,previous:6390},{label:"31–60 days",current:3970,previous:2840},{label:"61+ days",current:1850,previous:1270},{label:"Total receivables",current:42360,previous:35180,emphasis:"total"}]},
  { id:"ap-aging", name:"A/P aging", description:"Unpaid vendor balances by age.", rows:[{label:"Current",current:19140,previous:20820},{label:"1–30 days",current:6280,previous:7140},{label:"31–60 days",current:2410,previous:2260},{label:"61+ days",current:920,previous:1000},{label:"Total payables",current:28750,previous:31220,emphasis:"total"}]},
  { id:"profit-truck", name:"Profit by truck", description:"Revenue and contribution by power unit.", rows:[{label:"Unit 204",current:28410,previous:21880},{label:"Unit 118",current:21960,previous:17040},{label:"Unit 221",current:15070,previous:8890},{label:"Fleet contribution",current:65440,previous:47810,emphasis:"total"}]},
  { id:"profit-driver", name:"Profit by driver", description:"Contribution after driver-attributed costs.", rows:[{label:"Marcus Hill",current:24680,previous:18540},{label:"Dana Brooks",current:22110,previous:16920},{label:"Luis Rivera",current:18650,previous:12350},{label:"Driver contribution",current:65440,previous:47810,emphasis:"total"}]},
  { id:"cost-mile", name:"Cost per mile", description:"Operating costs divided by fleet mileage.", rows:[{label:"Fuel per mile",current:.73,previous:.79},{label:"Driver pay per mile",current:1,previous:1.02},{label:"Maintenance per mile",current:.29,previous:.31},{label:"Other costs per mile",current:.77,previous:.81},{label:"Total cost per mile",current:2.79,previous:2.93,emphasis:"total"}]},
  { id:"fuel-summary", name:"Fuel summary", description:"Fuel spend, volume, and efficiency.", rows:[{label:"Fuel spend",current:31284,previous:29410},{label:"Gallons purchased",current:4527,previous:4398,format:"number"},{label:"Average MPG",current:7.4,previous:7.1,format:"number"},{label:"Cost per gallon",current:6.91,previous:6.69}]},
  { id:"year-end", name:"Year-end package", description:"Accountant-ready annual overview.", rows:[{label:"Gross revenue",current:1849200,previous:1598400},{label:"Operating expenses",current:1194800,previous:1083210},{label:"Net income",current:654400,previous:515190},{label:"Closing assets",current:559100,previous:543790},{label:"Closing liabilities",current:275550,previous:289620,emphasis:"total"}]},
];

function csvCell(value: string | number) {
  const text = typeof value === "string" && /^[=+@\-\t\r]/.test(value) ? `'${value}` : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}

export function reportToCsv(report: ReportDefinition, period: string) {
  return [
    [report.name, period, "Previous period"],
    ...report.rows.map(row=>[row.label,row.current,row.previous ?? ""]),
  ].map(row=>row.map(csvCell).join(",")).join("\n");
}

export function reportFileName(report: ReportDefinition, period: string) {
  const safePeriod=period.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
  return `${report.id}-${safePeriod || "report"}.csv`;
}
