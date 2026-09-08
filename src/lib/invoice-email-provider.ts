export type InvoiceEmailPayload={from:string;to:string[];subject:string;text:string;attachments:{filename:string;content:string}[]};
export class EmailSendError extends Error{constructor(message:string,readonly uncertain:boolean){super(message)}}
export async function sendInvoiceWithResend(apiKey:string,requestId:string,payload:InvoiceEmailPayload,fetcher:typeof fetch=fetch){
 let response:Response;
 try{response=await fetcher("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":`invoice/${requestId}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(20_000)})}
 catch{throw new EmailSendError("The email provider did not confirm receipt. Retry this same attempt to avoid duplicate email.",true)}
 if(!response.ok){
  const uncertain=response.status>=500||response.status===408||response.status===409||response.status===429;
  throw new EmailSendError(response.status===401||response.status===403?"The email provider rejected the credentials or sender domain. Check business email setup.":uncertain?"The email provider could not confirm this attempt. Retry the same attempt.":"The email provider rejected this message. Check the recipient and verified sender setup.",uncertain);
 }
 let id:unknown;try{id=(await response.json()).id}catch{}
 if(typeof id!=="string"||!id)throw new EmailSendError("The provider response was incomplete. Retry the same attempt.",true);
 return id;
}
