"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

const schema = z
  .object({
    username: z.string().min(1, "Username is required").transform((value) => value.trim().toLowerCase()),
    password: z.string().min(6, "Password must be at least 6 characters."),
    role: z.enum(["admin", "daycareadmin", "principal", "teacher", "parent"]),
    otp: z.string().optional()
  })
  .refine((value) => {
    if (["admin", "daycareadmin", "principal"].includes(value.role)) {
      return typeof value.otp === "string" && value.otp.trim().length >= 4;
    }
    return true;
  }, {
    message: "OTP is required for admins and principal",
    path: ["otp"]
  });

type LoginValues = z.infer<typeof schema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", role: "admin", otp: "" }
  });
  const role = watch("role");

  async function onSubmit(values: LoginValues) {
    try {
      await login(values);
    } catch (error) {
      console.error("[LoginForm] login error:", error);
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="rounded-[2rem] border border-slate-200 bg-slate-50/90 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Role</span>
          <select className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand-navy" {...register("role")}>
            <option value="admin">Administrator</option>
            <option value="daycareadmin">Daycare Admin</option>
            <option value="principal">Principal</option>
            <option value="teacher">Teacher</option>
            <option value="parent">Parent</option>
          </select>
        </label>
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          OTP verification required for Administrator, Daycare Admin & Principal logins.
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Username</span>
        <input
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand-navy"
          placeholder="e.g. admin"
          {...register("username")}
        />
        {errors.username && <span className="mt-1 block text-sm text-rose-600">{errors.username.message}</span>}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-1 transition focus-within:border-brand-navy">
          <input
            type={showPassword ? "text" : "password"}
            className="min-w-0 flex-1 bg-transparent px-0 py-3 text-slate-900 outline-none"
            placeholder="Enter password"
            {...register("password")}
          />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility" className="text-slate-500 transition hover:text-slate-900">
            <Eye size={18} />
          </button>
        </div>
        {errors.password && <span className="mt-1 block text-sm text-rose-600">{errors.password.message}</span>}
      </label>

      {(role === "admin" || role === "daycareadmin" || role === "principal") && (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">OTP Code</span>
          <input
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand-navy"
            placeholder="0000"
            inputMode="numeric"
            {...register("otp")}
          />
          {errors.otp && <span className="mt-1 block text-sm text-rose-600">{errors.otp.message}</span>}
        </label>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center rounded-full bg-brand-gold px-10 py-3 text-base font-bold text-slate-950 transition hover:bg-[#f5bf20]">
          <LogIn size={18} className="mr-2" />
          Sign in
        </Button>
        <button type="button" className="text-sm font-semibold text-brand-navy underline-offset-4 transition hover:text-brand-navy/80">
          Forgot Password?
        </button>
      </div>

      <p className="text-center text-xs text-slate-500">Use your username and password. Admins and principal must include OTP.</p>
    </form>
  );
}
