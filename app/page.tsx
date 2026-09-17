import Header from "./components/Header";
import ScreeningFlow from "./components/ScreeningFlow";
import FeaturesGrid from "./components/FeaturesGrid";
import AuthCard from "./components/AuthCard";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-surface flex flex-col justify-center" id="landing-page">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-center lg:items-start justify-between">
          {/* ——— Left Column: Value Proposition ——— */}
          <div className="flex-1 min-w-0 lg:max-w-[53%] xl:max-w-[54%]">
            <Header />

            {/* Headline with gradient and red highlight */}
            <h1 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-extrabold text-heading leading-[1.15] tracking-tight mb-2">
              <span className="bg-gradient-to-r from-primary via-[#dc2626] to-[#b91c1c] bg-clip-text text-transparent">
                Preliminary anemia screening,
              </span>{" "}
              <span>made simple.</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed mb-3.5 max-w-lg">
              Check your anemia risk using a non-invasive smartphone image of
              the lower eyelid and receive calibrated clinical wellness guidance
              in minutes.
            </p>

            {/* Screening Flow */}
            <ScreeningFlow />

            {/* Feature Cards */}
            <FeaturesGrid />

            {/* Regulatory Footer */}
            <Footer />
          </div>

          {/* ——— Right Column: Auth Card (Wider) ——— */}
          <div className="w-full lg:w-[460px] xl:w-[490px] shrink-0">
            <AuthCard />
          </div>
        </div>
      </div>
    </main>
  );
}
