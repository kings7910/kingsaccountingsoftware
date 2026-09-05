import {Role} from "@/lib/permissions";
export type MemberStatus="Invited"|"Active"|"Suspended";
export type TeamMember={id:string;name:string;email:string;role:Role;status:MemberStatus;invitedAt:string;lastActive:string};
export type MemberDraft=Pick<TeamMember,"name"|"email"|"role"|"status">;
export const demoMembers:TeamMember[]=[
 {id:"tm-1",name:"Kendra Williams",email:"kendra@kingstransport.com",role:"owner",status:"Active",invitedAt:"2026-01-02T12:00:00Z",lastActive:"2026-09-04T10:22:00Z"},
 {id:"tm-2",name:"Andre Cole",email:"andre@kingstransport.com",role:"accountant",status:"Active",invitedAt:"2026-02-15T12:00:00Z",lastActive:"2026-09-04T09:04:00Z"},
 {id:"tm-3",name:"Maya Chen",email:"maya@kingstransport.com",role:"dispatcher",status:"Active",invitedAt:"2026-03-10T12:00:00Z",lastActive:"2026-09-04T08:37:00Z"},
 {id:"tm-4",name:"Marcus Hill",email:"marcus@kingstransport.com",role:"driver",status:"Active",invitedAt:"2026-04-08T12:00:00Z",lastActive:"2026-09-03T18:25:00Z"},
 {id:"tm-5",name:"Dana Brooks",email:"dana@kingstransport.com",role:"driver",status:"Invited",invitedAt:"2026-09-02T12:00:00Z",lastActive:""},
];
export function validateMember(draft:MemberDraft,members:TeamMember[],editingId?:string){const errors:Record<string,string>={};if(!draft.name.trim())errors.name="Name is required.";if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))errors.email="Enter a valid email.";if(members.some(x=>x.id!==editingId&&x.email.toLowerCase()===draft.email.trim().toLowerCase()))errors.email="This email already belongs to a team member.";return errors}
export function isLastActiveOwner(member:TeamMember,members:TeamMember[]){return member.role==="owner"&&member.status==="Active"&&members.filter(x=>x.id!==member.id&&x.role==="owner"&&x.status==="Active").length===0}
export function canChangeMember(member:TeamMember,next:MemberDraft,members:TeamMember[]){return !(isLastActiveOwner(member,members)&&(next.role!=="owner"||next.status!=="Active"))}
export const roleLabel=(role:Role)=>role.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
