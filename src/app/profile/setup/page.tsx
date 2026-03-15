"use client"

import { Suspense } from "react"
import ProfileSetupClient from "./profile-setup-client"

export default function ProfileSetupPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Chargement…</div>}>
      <ProfileSetupClient />
    </Suspense>
  )
}
