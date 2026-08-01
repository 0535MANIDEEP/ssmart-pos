"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { BrandFooter } from "@/components/BrandFooter";
import { api, ApiError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    setServerError(null);
    try {
      await api.post("/auth/login", values);
      router.replace("/dashboard");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Login failed");
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-brand/20 blur-xl" />
            <Image
              src="/logo.png"
              alt="SS Mart"
              width={80}
              height={80}
              className="relative h-20 w-20 rounded-2xl border-2 border-white/10 shadow-2xl"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              SS Mart
            </h1>
            <p className="text-sm font-medium text-blue-300/80">
              Sai Sangameshwara Mart
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="mb-6 text-center text-lg font-semibold text-white/90">
            Sign in to your account
          </h2>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            {serverError && (
              <p
                role="alert"
                className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {serverError}
              </p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl py-2.5 font-semibold shadow-lg"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>

        {/* Store Info Card */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-green-400/80">
              Store Information
            </span>
          </div>
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex justify-between">
              <span className="text-white/50">Address</span>
              <span className="text-right font-medium text-white/80">
                1234 Main Road, Near Temple
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">City</span>
              <span className="font-medium text-white/80">
                Shankarpally, Telangana
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Pincode</span>
              <span className="font-medium text-white/80">501203</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Phone</span>
              <span className="font-medium text-white/80">9876543210</span>
            </div>
            <div className="my-2 border-t border-white/10" />
            <div className="flex justify-between">
              <span className="text-white/50">GSTIN</span>
              <span className="font-mono text-xs font-medium text-white/80">
                36AABCS1234E1Z5
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">PAN</span>
              <span className="font-mono text-xs font-medium text-white/80">
                AABCS1234E
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Currency</span>
              <span className="font-medium text-white/80">INR (₹)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-center text-[11px] leading-tight text-white/30">
            <span className="font-semibold text-white/50">
              Manideep Daram
            </span>
          </p>
          <BrandFooter className="!text-white/30 [&_a]:!text-white/50 [&_a]:hover:!text-blue-400" />
        </div>
      </div>
    </div>
  );
}
