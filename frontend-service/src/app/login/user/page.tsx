import { AuthFrame } from "@/components/auth/AuthFrame";
import { UserAuthForm } from "@/components/auth/UserAuthForm";
export default function UserLoginPage(){return <AuthFrame audience="shopper"><UserAuthForm mode="login"/></AuthFrame>;}
