import { Shield } from 'lucide-react'
import { useEffect,useState } from 'react'
import { assetUrl } from '../../lib/assetUrl'
import './ArmorIcon.css'

export function ArmorIcon({ path,name,size='small' }: { path:string|null;name:string;size?:'small'|'large' }){const[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[path]);const source=failed?undefined:assetUrl(path);return <span className={`armor-icon armor-icon--${size}`} title={source?undefined:`${name}暂无图标`}>{source?<img src={source} alt="" width="16" height="16" onError={()=>setFailed(true)}/>:<Shield aria-hidden="true"/>}</span>}
