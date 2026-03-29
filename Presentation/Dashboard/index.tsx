import { DashboardHeader } from "@/components/DashboardHeader"
import { DashboardContent } from "@/components/DashboardContent"
import { StatsSection } from "@/components/StatsSection"
import { MainContent } from "@/components/MainContent"
import { DashboardInsights } from "@/components/DashboardInsights"
import { DashboardFooter } from "@/components/DashboardFooter"
import { DashboardDataSync } from "@/components/DashboardDataSync"
import { FloatingChatbotButton } from "@/components/FloatingChatbotButton"

export function Dashboard() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <DashboardDataSync />
      <DashboardHeader />

      <DashboardContent>
        {/* Stats Cards Section */}
        <StatsSection />

        <MainContent />

        <DashboardInsights />
      </DashboardContent>

      <DashboardFooter />
      <FloatingChatbotButton />
    </div>
  )
}
