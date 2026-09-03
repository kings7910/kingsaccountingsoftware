import { Banknote, Boxes, ChartNoAxesCombined, ClipboardList, FileText, Fuel, LayoutDashboard, ReceiptText, Route, Settings, ShieldCheck, Truck, Users, Wrench } from "lucide-react";

export const navigation = [
  { label:"Overview", icon:LayoutDashboard }, { label:"Transactions", icon:ReceiptText }, { label:"Invoices", icon:FileText },
  { label:"Loads & routes", icon:Route }, { label:"Fleet", icon:Truck }, { label:"Fuel & mileage", icon:Fuel },
  { label:"Maintenance", icon:Wrench }, { label:"Payroll", icon:Banknote }, { label:"Accounting", icon:Boxes },
  { label:"Reports", icon:ChartNoAxesCombined }, { label:"Approvals", icon:ClipboardList }, { label:"Team & roles", icon:Users },
  { label:"Audit log", icon:ShieldCheck }, { label:"Settings", icon:Settings },
];

export const stats = [
  { label:"Total income", value:"$184,920", change:"+12.4%", tone:"teal" },
  { label:"Total expenses", value:"$119,480", change:"+4.1%", tone:"navy" },
  { label:"Estimated net profit", value:"$65,440", change:"+18.6%", tone:"gold" },
  { label:"Outstanding invoices", value:"$42,360", change:"6 invoices", tone:"orange" },
];

export const cashFlow = [
  {month:"Apr",income:108,expenses:76},{month:"May",income:124,expenses:82},{month:"Jun",income:118,expenses:88},
  {month:"Jul",income:151,expenses:94},{month:"Aug",income:142,expenses:101},{month:"Sep",income:185,expenses:119},
];

export const recent = [
  { title:"BlueLine Logistics", detail:"Invoice #INV-1048", amount:"+$8,450.00", status:"Paid", kind:"income" },
  { title:"Pilot Travel Center", detail:"Diesel · Unit 204", amount:"−$612.84", status:"Matched", kind:"expense" },
  { title:"Martin Fleet Services", detail:"Maintenance · Unit 118", amount:"−$1,285.00", status:"Needs review", kind:"expense" },
  { title:"Great West Casualty", detail:"Insurance", amount:"−$2,940.00", status:"Scheduled", kind:"expense" },
];

export const loads = [
  { number:"LD-2841", lane:"Atlanta, GA → Dallas, TX", driver:"Marcus Hill", unit:"204", value:"$4,850", status:"In transit" },
  { number:"LD-2840", lane:"Savannah, GA → Charlotte, NC", driver:"Dana Brooks", unit:"118", value:"$2,320", status:"At delivery" },
  { number:"LD-2839", lane:"Memphis, TN → Orlando, FL", driver:"Luis Rivera", unit:"221", value:"$3,760", status:"Delivered" },
];

export const alerts = [
  { title:"3 receipts need review", detail:"Two may be duplicates", urgency:"Today" },
  { title:"Unit 118 service due", detail:"Oil change in 420 miles", urgency:"Soon" },
  { title:"Insurance expires", detail:"Unit 204 · Sep 18", urgency:"15 days" },
];
