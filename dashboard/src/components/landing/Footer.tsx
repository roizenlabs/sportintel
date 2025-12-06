import { Link } from 'react-router-dom'
import { Github, Twitter } from 'lucide-react'
import Logo from '../Logo'

const footerSections = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'API Docs', href: '/docs' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Contact', href: 'mailto:support@roizenlabs.com' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <Logo size="lg" />
              <div>
                <div className="text-white font-bold">RoizenLabs</div>
                <div className="text-xs text-gray-400">Betting Intelligence</div>
              </div>
            </Link>
            <p className="text-gray-400 text-sm mb-4">
              Real-time arbitrage detection and sports betting analytics.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              <a
                href="https://twitter.com/roizenlabs"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://github.com/roizenlabs"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-white font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('http') || link.href.startsWith('mailto') ? (
                      <a
                        href={link.href}
                        className="text-gray-400 hover:text-white transition-colors text-sm"
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {link.label}
                      </a>
                    ) : link.href.startsWith('#') ? (
                      <a
                        href={link.href}
                        className="text-gray-400 hover:text-white transition-colors text-sm"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-gray-400 hover:text-white transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} RoizenLabs. All rights reserved.
          </p>
          <p className="text-gray-500 text-sm">
            For informational and educational purposes only.
          </p>
        </div>
      </div>
    </footer>
  )
}
