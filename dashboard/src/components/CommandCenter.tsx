import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  LayoutDashboard, Video, Scissors, Calendar, MessageCircle,
  ChevronLeft, ChevronRight, X, Settings, Bell,
  Trash2, Plus, Check, CheckCheck, Send,
  Eye, BarChart3, TrendingUp, Users, Heart, PieChart, Activity,
  ArrowUp, Target, Zap, Clock,
  Crown, Flag, ThumbsUp, ThumbsDown, Minus,
  Inbox, User, Rocket, Globe
} from 'lucide-react';

// Platform icons as simple components
const TwitterIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
const LinkedInIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);
const RedditIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
);
const ProductHuntIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <Rocket className={className} style={style} />
);
const HackerNewsIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <Globe className={className} style={style} />
);
const DiscordIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <MessageCircle className={className} style={style} />
);

// ============================================
// CONTEXT & CONFIGURATION
// ============================================

interface AppContextType {
  videos: Video[];
  posts: Post[];
  engagements: Engagement[];
  analytics: Analytics;
  addVideo: (v: Video) => void;
  removeVideo: (id: number) => void;
  updateVideo: (id: number, u: Partial<Video>) => void;
  addPost: (p: Post) => void;
  removePost: (id: number) => void;
  updateEngagement: (id: number, u: Partial<Engagement>) => void;
}

interface Video {
  id: number;
  name: string;
  url?: string;
  blob?: Blob;
  duration: number;
  timestamp: string;
  tags: string[];
}

interface Post {
  id: number;
  platform: string;
  content: string;
  date: string;
  time: string;
  video?: string | null;
  status: string;
  campaign?: string;
  note?: string;
  createdAt: string;
}

interface Engagement {
  id: number;
  platform: string;
  user: {
    name: string;
    handle: string;
    influencer: boolean;
    followers: number;
  };
  text: string;
  sentiment: string;
  priority: string;
  timestamp: string;
  status: string;
  starred: boolean;
  likes: number;
  replies: number;
  replyText?: string;
}

interface Analytics {
  reach: number;
  engagement: number;
  followers: number;
}

const AppContext = createContext<AppContextType | null>(null);
const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

const PLATFORMS: Record<string, { name: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; maxChars: number; maxVideo: string | null }> = {
  twitter: { name: 'Twitter/X', icon: TwitterIcon, color: '#1DA1F2', maxChars: 280, maxVideo: '2:20' },
  reddit: { name: 'Reddit', icon: RedditIcon, color: '#FF4500', maxChars: 40000, maxVideo: null },
  linkedin: { name: 'LinkedIn', icon: LinkedInIcon, color: '#0A66C2', maxChars: 3000, maxVideo: '10:00' },
  discord: { name: 'Discord', icon: DiscordIcon, color: '#5865F2', maxChars: 2000, maxVideo: null },
  producthunt: { name: 'Product Hunt', icon: ProductHuntIcon, color: '#DA552F', maxChars: 260, maxVideo: '3:00' },
  hackernews: { name: 'Hacker News', icon: HackerNewsIcon, color: '#FF6600', maxChars: 0, maxVideo: null }
};

const SENTIMENT: Record<string, { color: string; bg: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  positive: { color: 'text-green-400', bg: 'bg-green-500/20', icon: ThumbsUp, label: 'Positive' },
  neutral: { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: Minus, label: 'Neutral' },
  negative: { color: 'text-red-400', bg: 'bg-red-500/20', icon: ThumbsDown, label: 'Negative' },
  question: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: MessageCircle, label: 'Question' }
};

const TEMPLATES = {
  replies: {
    thanks: "Thanks for checking out RoizenLabs! Let me know if you have any questions about the platform.",
    signup: "You can try it free at https://roizenlabs.com - no credit card required!",
    question: "Great question! ",
    feature: "Love this suggestion! We're always looking to improve. Would you mind sharing more details?",
    bug: "Thanks for reporting! Can you share more details about what you're seeing? Happy to help debug.",
    pricing: "RoizenLabs has a free tier with real-time odds. Pro adds advanced arbitrage alerts and steam move notifications.",
    arbitrage: "Arbitrage betting is when you find odds discrepancies between sportsbooks that guarantee profit regardless of outcome. RoizenLabs finds these automatically.",
    steammoves: "Steam moves happen when sharp money moves a line. If you catch it early on other books, you can bet the old line before it adjusts."
  },
  posts: {
    announcement: {
      twitter: "Introducing RoizenLabs - Real-time arbitrage detection across 15+ sportsbooks.\n\nFind profitable opportunities before they disappear.\n\nFree tier available. No credit card required.\n\nhttps://roizenlabs.com\n\n#SportsBetting #Arbitrage #BettingTools",
      reddit: "Built a free tool for finding arbitrage opportunities - looking for feedback\n\nI've been working on a tool that monitors odds across multiple sportsbooks in real-time to find arbitrage opportunities and steam moves.\n\nWhat it does:\n- Compares odds across 15+ books\n- Alerts on profitable arb opportunities\n- Tracks line movements (steam moves)\n- Free tier available\n\nWould love feedback from the community.\n\nhttps://roizenlabs.com",
      linkedin: "Excited to announce RoizenLabs - solving the sports betting intelligence problem.\n\nFinding arbitrage opportunities manually? Nearly impossible. Lines move in seconds.\n\nRoizenLabs monitors 15+ sportsbooks in real-time, alerting you to profitable discrepancies before they disappear.\n\nThe edge sharp bettors use - now accessible to everyone.\n\nFree tier available: https://roizenlabs.com"
    },
    demo: {
      twitter: "Watch this:\n\nRoizenLabs found 47 arbitrage opportunities today.\n\nAverage profit margin: 2.3%\n\nMost arbs close in under 60 seconds.\n\nThat's why real-time monitoring matters.\n\nhttps://roizenlabs.com",
      reddit: "Just sharing some stats from RoizenLabs today:\n\n- 47 arbitrage opportunities detected\n- Average profit margin: 2.3%\n- Fastest arb closed in: 23 seconds\n\nThis is why manual arb hunting doesn't work. You need real-time alerts.\n\nAnyone else tracking their arb success rate?"
    },
    education: {
      twitter: "What is a steam move?\n\nWhen sharp money hits a line, ALL books adjust quickly.\n\nIf you see Book A move first, you have seconds to bet Book B at the old line.\n\nThis is how sharps make money.\n\nRoizenLabs tracks this in real-time.",
      linkedin: "Sports Betting 101: Understanding Steam Moves\n\nWhen professional bettors (sharps) place large wagers, sportsbooks adjust their lines almost instantly.\n\nThe key? Different books move at different speeds.\n\nIf you can identify which book moved first and quickly bet the others at the old line, you're essentially getting the same edge the sharps have.\n\nThis is what RoizenLabs monitors - line movements across 15+ sportsbooks in real-time."
    },
    testimonial: {
      twitter: "\"I spent 2 hours a day manually checking odds across books. RoizenLabs does it automatically and alerts me when there's an opportunity.\"\n\nReal user. Real problem. Real solution.\n\nhttps://roizenlabs.com",
      reddit: "Sharing my experience after a week with RoizenLabs:\n\nBefore: Spent 2+ hours daily checking odds across multiple sportsbooks\nAfter: Get instant alerts when arb opportunities appear\n\nThe time savings alone make it worth it, even on the free tier."
    }
  },
  campaigns: {
    launchDay: {
      name: "Launch Day Blitz",
      posts: [
        { time: "06:00", platform: "twitter", type: "announcement", note: "Main launch tweet" },
        { time: "07:00", platform: "reddit", type: "announcement", note: "r/sportsbook post (value-focused)" },
        { time: "09:00", platform: "linkedin", type: "announcement", note: "Professional announcement" },
        { time: "11:00", platform: "twitter", type: "education", note: "Educational content" },
        { time: "13:00", platform: "producthunt", type: "announcement", note: "Product Hunt launch" },
        { time: "15:00", platform: "twitter", type: "demo", note: "Stats/demo tweet" },
        { time: "17:00", platform: "discord", type: "announcement", note: "Betting community posts" },
        { time: "19:00", platform: "twitter", type: "testimonial", note: "Social proof" },
        { time: "21:00", platform: "hackernews", type: "announcement", note: "Show HN" }
      ]
    },
    weeklyDrip: {
      name: "Weekly Content",
      posts: [
        { day: "Monday", time: "09:00", platform: "twitter", type: "education", note: "Educational thread" },
        { day: "Tuesday", time: "10:00", platform: "reddit", type: "demo", note: "Value post" },
        { day: "Wednesday", time: "09:00", platform: "twitter", type: "demo", note: "Stats update" },
        { day: "Thursday", time: "14:00", platform: "linkedin", type: "education", note: "Industry insight" },
        { day: "Friday", time: "11:00", platform: "twitter", type: "testimonial", note: "User story" }
      ]
    }
  }
};

// ============================================
// UTILITIES
// ============================================

// const formatTime = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const formatTimeAgo = (ts: string) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const generateEngagements = (): Engagement[] => {
  const users = [
    { name: 'Sharp_Mike', handle: '@sharp_mike_bets', influencer: true, followers: 45000 },
    { name: 'BettingPro', handle: '@bettingpro_tips', influencer: true, followers: 128000 },
    { name: 'CasualBettor', handle: '@casualbettor22', influencer: false, followers: 1200 },
    { name: 'SportsFan', handle: '@sportsfan_daily', influencer: false, followers: 3400 },
    { name: 'ArbHunter', handle: '@arb_hunter', influencer: false, followers: 890 },
    { name: 'LineWatcher', handle: '@linewatcher', influencer: true, followers: 67000 }
  ];
  const comments = [
    { text: "This is exactly what I've been looking for! Finally a tool that actually tracks arbs in real-time.", sentiment: 'positive' },
    { text: "How does this compare to other arb finders? What makes it different?", sentiment: 'question' },
    { text: "Just caught my first arb with this. 2.1% guaranteed profit.", sentiment: 'positive' },
    { text: "Does this work with offshore books or just US legal books?", sentiment: 'question' },
    { text: "Congrats on the launch! This looks really promising for the sharp community.", sentiment: 'positive' },
    { text: "What's the latency on the odds updates? Speed is everything for arbs.", sentiment: 'question' },
    { text: "Been using this for a week - caught 12 arbs that I would have missed manually.", sentiment: 'positive' },
    { text: "Getting some lag on the dashboard, might be my connection though.", sentiment: 'negative' },
    { text: "Can you add alerts for specific sports? I only bet NBA.", sentiment: 'question' },
    { text: "The steam move alerts alone are worth it. Caught 3 today before the line moved.", sentiment: 'positive' }
  ];
  const platforms = Object.keys(PLATFORMS);

  return Array.from({ length: 20 }, (_, i) => {
    const user = users[Math.floor(Math.random() * users.length)];
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    return {
      id: Date.now() + i,
      platform,
      user: { ...user },
      text: comment.text,
      sentiment: comment.sentiment,
      priority: user.influencer ? 'high' : comment.sentiment === 'negative' ? 'high' : comment.sentiment === 'question' ? 'medium' : 'low',
      timestamp: new Date(Date.now() - Math.random() * 172800000).toISOString(),
      status: Math.random() > 0.7 ? 'replied' : 'pending',
      starred: Math.random() > 0.9,
      likes: Math.floor(Math.random() * 100),
      replies: Math.floor(Math.random() * 20)
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// ============================================
// DASHBOARD
// ============================================

function Dashboard({ navigate }: { navigate: (view: string) => void }) {
  const { videos, posts, engagements, analytics } = useApp();
  const pending = engagements.filter(e => e.status === 'pending').length;
  const scheduled = posts.filter(p => p.status === 'scheduled').length;

  const stats = [
    { label: 'Videos Ready', value: videos.length, icon: Video, color: 'purple', action: () => navigate('library') },
    { label: 'Scheduled', value: scheduled, icon: Calendar, color: 'blue', action: () => navigate('scheduler') },
    { label: 'Pending', value: pending, icon: MessageCircle, color: 'yellow', action: () => navigate('engagement') },
    { label: 'Reach', value: analytics.reach.toLocaleString(), icon: Eye, color: 'green', action: () => navigate('analytics') }
  ];

  const checklist = [
    { label: 'Test signup flow', done: true },
    { label: 'Prepare social accounts', done: true },
    { label: 'Schedule launch posts (5+)', done: scheduled >= 5 },
    { label: 'Create demo video', done: videos.length >= 1 },
    { label: 'Prepare reply templates', done: true }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Command Center
          </h1>
          <p className="text-slate-400 mt-1">RoizenLabs Marketing Hub</p>
        </div>
        <div className="text-sm text-slate-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <button key={i} onClick={s.action} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl p-5 text-left transition group">
            <s.icon className={`w-6 h-6 text-${s.color}-400 mb-3`} />
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm text-slate-400">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Launch Checklist */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-green-400" />
            Launch Checklist
          </h2>
          <div className="space-y-3">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${item.done ? 'bg-green-500' : 'bg-slate-700 border border-slate-600'}`}>
                  {item.done && <Check className="w-3 h-3" />}
                </div>
                <span className={item.done ? 'text-slate-500 line-through' : ''}>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Progress</span>
              <span className="text-green-400">{checklist.filter(c => c.done).length}/{checklist.length}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                   style={{ width: `${(checklist.filter(c => c.done).length / checklist.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Record', icon: Video, action: () => navigate('recorder'), gradient: 'from-purple-600 to-pink-600' },
              { label: 'Edit', icon: Scissors, action: () => navigate('editor'), gradient: 'from-blue-600 to-cyan-600' },
              { label: 'Schedule', icon: Calendar, action: () => navigate('scheduler'), gradient: 'from-green-600 to-emerald-600' },
              { label: 'Respond', icon: MessageCircle, action: () => navigate('engagement'), gradient: 'from-orange-600 to-red-600' }
            ].map((a, i) => (
              <button key={i} onClick={a.action} className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${a.gradient} hover:opacity-90 transition`}>
                <a.icon className="w-6 h-6" />
                <span className="text-sm font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-400" />
            Recent Activity
          </h2>
          <div className="space-y-3">
            {engagements.slice(0, 4).map((e, i) => {
              const S = SENTIMENT[e.sentiment];
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg ${S.bg} flex items-center justify-center`}>
                    <S.icon className={`w-4 h-4 ${S.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{e.user.name}</p>
                    <p className="text-xs text-slate-500">{formatTimeAgo(e.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Platform Overview */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-green-400" />
          Platform Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(PLATFORMS).map(([key, p]) => {
            const count = posts.filter(post => post.platform === key).length;
            const Icon = p.icon;
            return (
              <div key={key} className="text-center p-4 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 transition">
                <Icon className="w-8 h-8 mx-auto mb-2" style={{ color: p.color }} />
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-slate-400 mt-1">{count} posts</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCHEDULER (Simplified for brevity)
// ============================================

function Scheduler() {
  const { posts, addPost, removePost } = useApp();
  const [showComposer, setShowComposer] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [draft, setDraft] = useState({ content: '', platforms: ['twitter'], date: new Date().toISOString().split('T')[0], time: '09:00', video: null as string | null });

  const scheduled = posts.filter(p => p.status === 'scheduled').sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());

  const handleCreate = () => {
    if (!draft.content || !draft.platforms.length) return;
    draft.platforms.forEach(p => {
      addPost({ id: Date.now() + Math.random(), platform: p, content: draft.content, date: draft.date, time: draft.time, video: draft.video, status: 'scheduled', createdAt: new Date().toISOString() });
    });
    setDraft({ content: '', platforms: ['twitter'], date: new Date().toISOString().split('T')[0], time: '09:00', video: null });
    setShowComposer(false);
  };

  const applyCampaign = (campaign: typeof TEMPLATES.campaigns.launchDay) => {
    const today = new Date();
    campaign.posts.forEach((p, i) => {
      const date = new Date(today);
      const postType = TEMPLATES.posts[p.type as keyof typeof TEMPLATES.posts] as Record<string, string> | undefined;
      const template = postType?.[p.platform] || postType?.twitter || '';
      addPost({
        id: Date.now() + i,
        platform: p.platform,
        content: template,
        date: date.toISOString().split('T')[0],
        time: p.time,
        status: 'scheduled',
        campaign: campaign.name,
        note: p.note,
        createdAt: new Date().toISOString()
      });
    });
    setShowCampaigns(false);
  };

  const useTemplate = (type: string) => {
    const platform = draft.platforms[0] || 'twitter';
    const templates = TEMPLATES.posts[type as keyof typeof TEMPLATES.posts];
    const template = templates?.[platform as keyof typeof templates] || templates?.twitter || '';
    setDraft(d => ({ ...d, content: template }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Post Scheduler</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCampaigns(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
            <Rocket className="w-4 h-4" /> Campaigns
          </button>
          <button onClick={() => setShowComposer(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg">
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Scheduled', value: scheduled.length, color: 'blue' },
          { label: 'Today', value: scheduled.filter(p => p.date === new Date().toISOString().split('T')[0]).length, color: 'green' },
          { label: 'This Week', value: scheduled.filter(p => new Date(p.date).getTime() <= Date.now() + 7 * 86400000).length, color: 'purple' }
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold text-${s.color}-400`}>{s.value}</div>
            <div className="text-sm text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Posts List */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {scheduled.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">No posts scheduled</p>
            <button onClick={() => setShowComposer(true)} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg">Create First Post</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {scheduled.map(post => {
              const P = PLATFORMS[post.platform];
              const Icon = P.icon;
              return (
                <div key={post.id} className="p-4 hover:bg-slate-700/30 transition">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${P.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: P.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{P.name}</span>
                        {post.campaign && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">{post.campaign}</span>}
                      </div>
                      <p className="text-slate-300 text-sm line-clamp-2 mb-2">{post.content}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(post.date)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.time}</span>
                      </div>
                    </div>
                    <button onClick={() => removePost(post.id)} className="p-2 hover:bg-red-600 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Create Post</h2>
              <button onClick={() => setShowComposer(false)} className="p-2 hover:bg-slate-700 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Platforms */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(PLATFORMS).map(([k, p]) => {
                    const Icon = p.icon;
                    return (
                      <button key={k} onClick={() => setDraft(d => ({ ...d, platforms: d.platforms.includes(k) ? d.platforms.filter(x => x !== k) : [...d.platforms, k] }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${draft.platforms.includes(k) ? 'ring-2' : 'bg-slate-700'}`}
                        style={{ backgroundColor: draft.platforms.includes(k) ? `${p.color}20` : '', borderColor: p.color }}>
                        <Icon className="w-4 h-4" style={{ color: p.color }} />
                        <span className="text-sm">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Content</label>
                  <span className="text-xs text-slate-500">{draft.content.length} chars</span>
                </div>
                <textarea value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} rows={6} placeholder="What's happening with RoizenLabs?"
                  className="w-full bg-slate-700 rounded-lg p-3 resize-none" />
              </div>

              {/* Quick Templates */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Quick Templates</label>
                <div className="flex flex-wrap gap-2">
                  {['announcement', 'demo', 'education', 'testimonial'].map(t => (
                    <button key={t} onClick={() => useTemplate(t)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm capitalize">{t}</button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Date</label>
                  <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className="w-full bg-slate-700 rounded-lg p-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Time</label>
                  <input type="time" value={draft.time} onChange={e => setDraft(d => ({ ...d, time: e.target.value }))} className="w-full bg-slate-700 rounded-lg p-2" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
              <button onClick={() => setShowComposer(false)} className="px-4 py-2 bg-slate-700 rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={!draft.content || !draft.platforms.length} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg">Schedule Post</button>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Modal */}
      {showCampaigns && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Campaign Templates</h2>
              <button onClick={() => setShowCampaigns(false)} className="p-2 hover:bg-slate-700 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {Object.entries(TEMPLATES.campaigns).map(([k, c]) => (
                <div key={k} className="bg-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span className="text-xs text-slate-400">{c.posts.length} posts</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    {c.posts.slice(0, 3).map(p => PLATFORMS[p.platform].name).join(', ')}...
                  </p>
                  <button onClick={() => applyCampaign(c)} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm">Apply Campaign</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ENGAGEMENT TRACKER
// ============================================

function Engagement() {
  const { engagements, updateEngagement } = useApp();
  const [selected, setSelected] = useState<Engagement | null>(null);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState({ status: 'all', sentiment: 'all', platform: 'all' });

  const filtered = engagements.filter(e => {
    if (filter.status !== 'all' && e.status !== filter.status) return false;
    if (filter.sentiment !== 'all' && e.sentiment !== filter.sentiment) return false;
    if (filter.platform !== 'all' && e.platform !== filter.platform) return false;
    return true;
  });

  const pending = engagements.filter(e => e.status === 'pending').length;

  const markReplied = () => {
    if (!selected) return;
    updateEngagement(selected.id, { status: 'replied', replyText: reply });
    setReply('');
    const next = filtered.find(e => e.id !== selected.id && e.status === 'pending');
    setSelected(next || null);
  };

  const useTemplate = (key: string) => setReply(r => r + TEMPLATES.replies[key as keyof typeof TEMPLATES.replies]);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-56 bg-slate-800/50 border-r border-slate-700 p-4 flex flex-col">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Inbox className="w-5 h-5" /> Inbox
        </h2>
        <div className="space-y-1 mb-6">
          {[
            { key: 'all', label: 'All', icon: Inbox, count: engagements.length },
            { key: 'pending', label: 'Pending', icon: Clock, count: pending, highlight: true },
            { key: 'replied', label: 'Replied', icon: CheckCheck, count: engagements.length - pending }
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(v => ({ ...v, status: f.key }))}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${filter.status === f.key ? (f.highlight ? 'bg-yellow-600' : 'bg-green-600') : 'hover:bg-slate-700'}`}>
              <span className="flex items-center gap-2"><f.icon className="w-4 h-4" /> {f.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${f.highlight && f.key === 'pending' ? 'bg-yellow-500/30' : 'bg-slate-600'}`}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 uppercase mb-2">Sentiment</div>
        <div className="space-y-1">
          {Object.entries(SENTIMENT).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(f => ({ ...f, sentiment: filter.sentiment === k ? 'all' : k, status: 'all' }))}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${filter.sentiment === k ? v.bg : 'hover:bg-slate-700'} ${filter.sentiment === k ? v.color : ''}`}>
              <v.icon className="w-4 h-4" /> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className={`flex-1 flex flex-col ${selected ? 'lg:w-1/2' : ''}`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {filter.status === 'pending' ? 'Pending' : filter.sentiment !== 'all' ? SENTIMENT[filter.sentiment].label : 'All'} ({filtered.length})
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No engagements found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {filtered.map(e => {
                const P = PLATFORMS[e.platform];
                const S = SENTIMENT[e.sentiment];
                const Icon = P.icon;
                return (
                  <div key={e.id} onClick={() => setSelected(e)}
                    className={`p-4 cursor-pointer hover:bg-slate-800/50 transition ${selected?.id === e.id ? 'bg-green-900/20 border-l-2 border-green-500' : ''} ${e.status === 'replied' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: P.color }}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{e.user.name}</span>
                          {e.user.influencer && <Crown className="w-4 h-4 text-yellow-400" />}
                          <span className="text-slate-500 text-xs">{e.user.handle}</span>
                        </div>
                        <p className="text-slate-300 text-sm line-clamp-2 mb-2">{e.text}</p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-500">{formatTimeAgo(e.timestamp)}</span>
                          <span className={`flex items-center gap-1 ${S.color}`}><S.icon className="w-3 h-3" /> {S.label}</span>
                          {e.priority === 'high' && <span className="text-red-400 flex items-center gap-1"><Flag className="w-3 h-3" /> Priority</span>}
                        </div>
                      </div>
                      {e.status === 'replied' && <CheckCheck className="w-5 h-5 text-green-400 flex-shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="hidden lg:flex w-1/2 border-l border-slate-700 flex-col bg-slate-800/30">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {selected.user.name}
                  {selected.user.influencer && <Crown className="w-4 h-4 text-yellow-400" />}
                </div>
                <div className="text-sm text-slate-400">{selected.user.handle} - {selected.user.followers?.toLocaleString()} followers</div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-700 rounded-lg"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-slate-700/30 rounded-xl p-4 mb-4">
              <p className="text-slate-200 whitespace-pre-wrap">{selected.text}</p>
              <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
                <span>{formatTimeAgo(selected.timestamp)}</span>
                <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {selected.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> {selected.replies}</span>
              </div>
            </div>

            {selected.status === 'replied' && selected.replyText && (
              <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                  <CheckCheck className="w-4 h-4" /> Your Reply
                </div>
                <p className="text-slate-300 whitespace-pre-wrap">{selected.replyText}</p>
              </div>
            )}
          </div>

          {selected.status === 'pending' && (
            <div className="p-4 border-t border-slate-700">
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.keys(TEMPLATES.replies).slice(0, 6).map(k => (
                  <button key={k} onClick={() => useTemplate(k)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-full text-xs capitalize">{k}</button>
                ))}
              </div>
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write your reply..." rows={3} className="w-full bg-slate-700 rounded-xl p-3 resize-none mb-3" />
              <div className="flex items-center justify-end gap-2">
                <button onClick={markReplied} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">Mark Done</button>
                <button onClick={markReplied} disabled={!reply.trim()} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm">
                  <Send className="w-4 h-4" /> Send Reply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ANALYTICS
// ============================================

function AnalyticsDashboard() {
  const { analytics, posts, engagements } = useApp();

  const platformData = Object.entries(PLATFORMS).map(([k, p]) => ({
    key: k, platform: p,
    posts: posts.filter(x => x.platform === k).length,
    mentions: engagements.filter(x => x.platform === k).length
  }));

  const sentimentData = Object.entries(SENTIMENT).map(([k, v]) => ({
    key: k, ...v, count: engagements.filter(x => x.sentiment === k).length,
    percent: Math.round((engagements.filter(x => x.sentiment === k).length / (engagements.length || 1)) * 100)
  }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reach', value: analytics.reach.toLocaleString(), icon: Eye, change: 23.5 },
          { label: 'Engagement', value: analytics.engagement.toLocaleString(), icon: Heart, change: 18.2 },
          { label: 'Followers', value: analytics.followers.toLocaleString(), icon: Users, change: 12.8 },
          { label: 'Response Rate', value: `${Math.round((engagements.filter(e => e.status === 'replied').length / (engagements.length || 1)) * 100)}%`, icon: MessageCircle, change: 5.2 }
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <s.icon className="w-5 h-5 text-green-400" />
              <span className="flex items-center gap-1 text-xs text-green-400"><ArrowUp className="w-3 h-3" /> {s.change}%</span>
            </div>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-sm text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Performance */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><PieChart className="w-5 h-5 text-green-400" /> Platform Performance</h2>
          <div className="space-y-4">
            {platformData.map(d => {
              const Icon = d.platform.icon;
              return (
                <div key={d.key} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${d.platform.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: d.platform.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{d.platform.name}</span>
                      <span className="text-sm text-slate-400">{d.posts} posts</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((d.mentions / 5) * 20, 100)}%`, backgroundColor: d.platform.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sentiment Analysis */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Activity className="w-5 h-5 text-green-400" /> Sentiment Analysis</h2>
          <div className="space-y-4">
            {sentimentData.map(d => (
              <div key={d.key} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.bg}`}>
                  <d.icon className={`w-5 h-5 ${d.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-sm text-slate-400">{d.count} ({d.percent}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full`} style={{ width: `${d.percent}%`, backgroundColor: d.color.includes('green') ? '#22c55e' : d.color.includes('red') ? '#ef4444' : d.color.includes('blue') ? '#3b82f6' : '#64748b' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================

export default function CommandCenter() {
  const [view, setView] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // State
  const [videos, setVideos] = useState<Video[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [analytics] = useState({ reach: 45200, engagement: 3420, followers: 2850 });

  useEffect(() => { setEngagements(generateEngagements()); }, []);

  const ctx: AppContextType = {
    videos, posts, engagements, analytics,
    addVideo: v => setVideos(p => [v, ...p]),
    removeVideo: id => setVideos(p => p.filter(v => v.id !== id)),
    updateVideo: (id, u) => setVideos(p => p.map(v => v.id === id ? { ...v, ...u } : v)),
    addPost: p => setPosts(prev => [p, ...prev]),
    removePost: id => setPosts(p => p.filter(x => x.id !== id)),
    updateEngagement: (id, u) => setEngagements(p => p.map(e => e.id === id ? { ...e, ...u } : e))
  };

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scheduler', label: 'Schedule', icon: Calendar },
    { id: 'engagement', label: 'Engage', icon: MessageCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  const pending = engagements.filter(e => e.status === 'pending').length;

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-screen bg-slate-900 text-white flex">
        {/* Sidebar */}
        <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300`}>
          <div className="p-4 border-b border-slate-700 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            {!collapsed && <div><div className="font-bold">RoizenLabs</div><div className="text-xs text-slate-400">Command Center</div></div>}
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {nav.map(n => (
              <button key={n.id} onClick={() => setView(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition relative ${view === n.id ? 'bg-green-600' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                <n.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{n.label}</span>}
                {n.id === 'engagement' && pending > 0 && (
                  <span className={`${collapsed ? 'absolute top-0 right-0' : 'ml-auto'} bg-red-500 text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>{pending}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-slate-700">
            <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <><ChevronLeft className="w-5 h-5" /><span className="text-sm">Collapse</span></>}
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 bg-slate-800/50 border-b border-slate-700 px-6 flex items-center justify-between flex-shrink-0">
            <h1 className="text-lg font-semibold capitalize">{view}</h1>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-slate-700 rounded-lg relative">
                <Bell className="w-5 h-5" />
                {pending > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
              </button>
              <button className="p-2 hover:bg-slate-700 rounded-lg"><Settings className="w-5 h-5" /></button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {view === 'dashboard' && <Dashboard navigate={setView} />}
            {view === 'scheduler' && <Scheduler />}
            {view === 'engagement' && <Engagement />}
            {view === 'analytics' && <AnalyticsDashboard />}
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}
