import { AuthFrame } from "@/components/auth/AuthFrame";
import { ManagerAuthForm } from "@/components/auth/ManagerAuthForm";
export default function ManagerLoginPage(){return <AuthFrame audience="manager"><ManagerAuthForm/></AuthFrame>;}
