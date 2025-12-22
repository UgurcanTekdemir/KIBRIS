import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Zap, Calendar, FileText, Shield, Mail, Phone, Facebook, Twitter, Instagram } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { path: '/', label: 'Ana Sayfa', icon: Home },
    { path: '/live', label: 'Canlı Maçlar', icon: Zap },
    { path: '/matches', label: 'Tüm Maçlar', icon: Calendar },
    { path: '/coupons', label: 'Kuponlarım', icon: FileText },
  ];

  const legalLinks = [
    { path: '/terms', label: 'Kullanım Şartları' },
    { path: '/privacy', label: 'Gizlilik Politikası' },
    { path: '/responsible', label: 'Sorumlu Bahis' },
    { path: '/help', label: 'Yardım & Destek' },
  ];

  return (
    <footer className="bg-gradient-to-r from-[#0a0e14] to-[#141b27] border-t border-[#1e2736] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Logo & About */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center font-bold text-black text-xl">
                B
              </div>
              <span className="text-xl font-bold text-white">BullBet</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">
              Güvenilir ve eğlenceli bahis deneyimi için doğru adres. 
              En iyi oranlar ve canlı bahis seçenekleriyle yanınızdayız.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-amber-500 transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={20} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-amber-500 transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-amber-500 transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Hızlı Linkler</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className="flex items-center gap-2 text-gray-400 hover:text-amber-500 transition-colors text-sm"
                    >
                      <Icon size={16} />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Yasal Bilgiler</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-amber-500 transition-colors text-sm block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">İletişim</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Mail size={16} className="text-amber-500" />
                <a href="mailto:destek@bullbet.com" className="hover:text-amber-500 transition-colors">
                  destek@bullbet.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Phone size={16} className="text-amber-500" />
                <a href="tel:+905551234567" className="hover:text-amber-500 transition-colors">
                  +90 555 123 45 67
                </a>
              </li>
              <li className="flex items-start gap-2 text-gray-400 text-sm mt-4">
                <Shield size={16} className="text-amber-500 mt-0.5" />
                <span>
                  18 yaş altı bahis yasaktır. 
                  <br />
                  Sorumlu bahis oynayın.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#1e2736] pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm text-center md:text-left">
              © {currentYear} BullBet. Tüm hakları saklıdır.
            </p>
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <Shield size={14} />
              <span>Güvenli ve Lisanslı Bahis Platformu</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

