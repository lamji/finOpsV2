import { DashboardHeader } from "@/components/DashboardHeader"
import { DashboardContent } from "@/components/DashboardContent"
import { StatsSection } from "@/components/StatsSection"
import { ChartSection } from "@/components/ChartSection"
import { MainContent } from "@/components/MainContent"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { DashboardFooter } from "@/components/DashboardFooter"
import { DashboardDataSync } from "@/components/DashboardDataSync"

export function Dashboard() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <DashboardDataSync />
      <DashboardHeader />

      <DashboardContent>
        {/* Stats Cards Section */}
        <StatsSection />

        {/* Chart Section */}
        <ChartSection />

        {/* Main Content + Sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column (Main Content) */}
          <div className="lg:col-span-2">
            <MainContent />
          </div>

          {/* Right Column (Sidebar) */}
          <div>
            <DashboardSidebar />
          </div>
        </div>
      </DashboardContent>

      <DashboardFooter />
    </div>
  )
}
