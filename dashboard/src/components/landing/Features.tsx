import { Brain, Shield, Radio, Target, BarChart3, Activity, DollarSign, TrendingUp, Users, Bell, Smartphone } from 'lucide-react'

const valueProps = [
  {
    icon: Brain,
    title: 'AI-Powered Edge',
    description: 'Machine learning models analyze odds patterns to identify value and predict line movements.',
    color: 'green',
  },
  {
    icon: Shield,
    title: 'Arbitrage Detection',
    description: 'Automatically scan for risk-free arbitrage opportunities across all major sportsbooks.',
    color: 'blue',
  },
  {
    icon: Radio,
    title: 'Real-Time Intel',
    description: 'Live odds updates with instant alerts on steam moves, injuries, and sharp action.',
    color: 'yellow',
  },
  {
    icon: Target,
    title: 'Best Line Finder',
    description: 'Instantly find the best available odds across 6+ books to maximize your expected value.',
    color: 'purple',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Track your edge over closing lines and analyze your results across sports and bet types.',
    color: 'orange',
  },
]

const coreFeatures = [
  {
    icon: DollarSign,
    title: 'Market Scanner',
    description: 'Automatic detection of pricing inefficiencies across books',
  },
  {
    icon: TrendingUp,
    title: 'Line Movement Tracker',
    description: 'Steam move alerts when sharp money moves lines',
  },
  {
    icon: Activity,
    title: 'Live Odds Comparison',
    description: 'Compare odds across 6+ sportsbooks in real-time',
  },
  {
    icon: Users,
    title: 'Player Props Analysis',
    description: 'Compare player prop odds across all books',
  },
  {
    icon: Bell,
    title: 'Customizable Alerts',
    description: 'Telegram & Discord notifications for opportunities',
  },
  {
    icon: Smartphone,
    title: 'Multi-Sport Coverage',
    description: 'NFL, NBA, MLB, NHL with more coming soon',
  },
]

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'hover:border-green-500/30' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'hover:border-blue-500/30' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'hover:border-yellow-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'hover:border-purple-500/30' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'hover:border-orange-500/30' },
}

export default function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            The Edge You've Been Looking For
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Professional-grade analytics and real-time data for sports analysts
          </p>
        </div>

        {/* Value Props Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-20">
          {valueProps.map((prop) => {
            const colors = colorClasses[prop.color]
            return (
              <div
                key={prop.title}
                className={`bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 ${colors.border} transition-all group`}
              >
                <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <prop.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <h3 className="text-white font-semibold mb-2">{prop.title}</h3>
                <p className="text-gray-400 text-sm">{prop.description}</p>
              </div>
            )
          })}
        </div>

        {/* Core Features */}
        <div className="text-center mb-12">
          <h3 className="text-2xl font-bold text-white mb-4">Core Features</h3>
          <p className="text-gray-400">Everything you need to identify market opportunities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coreFeatures.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 p-6 bg-gray-800/30 rounded-xl border border-gray-800 hover:border-gray-700 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
