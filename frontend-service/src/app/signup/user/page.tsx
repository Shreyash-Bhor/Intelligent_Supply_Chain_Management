import { AuthFrame } from "@/components/auth/AuthFrame";
import { UserAuthForm } from "@/components/auth/UserAuthForm";
export default function UserSignupPage(){return <AuthFrame audience="shopper"><UserAuthForm mode="signup"/></AuthFrame>;}
