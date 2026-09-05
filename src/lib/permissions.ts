export const roles = ["owner", "administrator", "accountant", "dispatcher", "fleet_manager", "payroll_manager", "driver", "auditor"] as const;
export type Role = (typeof roles)[number];

const grants: Record<Role, readonly string[]> = {
  owner: ["*"],
  administrator: ["dashboard.view", "team.manage", "operations.manage", "documents.manage", "reports.view"],
  accountant: ["dashboard.view", "accounting.manage", "transactions.approve", "invoices.manage", "reports.export"],
  dispatcher: ["dashboard.view", "loads.manage", "routes.manage", "drivers.assign", "customers.view"],
  fleet_manager: ["dashboard.view", "fleet.manage", "maintenance.manage", "fuel.approve", "mileage.approve"],
  payroll_manager: ["dashboard.view", "payroll.manage", "settlements.manage", "pay_documents.manage"],
  driver: ["assignments.view_own", "trips.manage_own", "receipts.create", "pay_documents.view_own"],
  auditor: ["dashboard.view", "accounting.view", "reports.view", "audit.view"],
};

export function can(role: Role, permission: string) {
  return grants[role].includes("*") || grants[role].includes(permission);
}

const moduleGrants:Record<Role,readonly string[]>={
  owner:["*"],
  administrator:["Overview","Transactions","Invoices","Bills & payables","Loads & routes","Fleet","Fuel & mileage","Maintenance","Payroll","Accounting","Reports","Approvals","Team & roles","Audit log","Settings","AI assistant"],
  accountant:["Overview","Transactions","Invoices","Bills & payables","Fuel & mileage","Accounting","Reports","Approvals","AI assistant"],
  dispatcher:["Overview","Invoices","Loads & routes","Fleet","Fuel & mileage","Maintenance","Approvals","AI assistant"],
  fleet_manager:["Overview","Loads & routes","Fleet","Fuel & mileage","Maintenance","Approvals","AI assistant"],
  payroll_manager:["Overview","Payroll","Approvals","AI assistant"],
  driver:[],
  auditor:["Overview","Bills & payables","Accounting","Reports","Audit log","AI assistant"],
};

export function visibleModules(role:string){const normalized=roles.includes(role as Role)?role as Role:"auditor";return moduleGrants[normalized]}
export function canViewModule(role:string,module:string){const allowed=visibleModules(role);return allowed.includes("*")||allowed.includes(module)}
