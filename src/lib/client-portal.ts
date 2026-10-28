export function normalizeUsername(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,".").replace(/^\.+|\.+$/g,"").slice(0,48);}
export function clientAuthEmail(username:string){return `${username}@client.origine.invalid`;}
export function validatePassword(password:string){return password.length>=10&&/[a-z]/i.test(password)&&/\d/.test(password);}
const commonPasswords=new Set(["12345678","123456789","password","senha123","senha1234","qwerty123","admin123","origine123"]);
export function validateTemporaryPassword(password:string){const normalized=password.toLowerCase().replace(/\s/g,"");return password.length>=8&&/[a-z]/i.test(password)&&/\d/.test(password)&&!commonPasswords.has(normalized)&&!/(.)\1\1/.test(password);}
export function clientPortalDestination(){return "/cliente";}
