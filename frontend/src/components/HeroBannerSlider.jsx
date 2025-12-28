import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Carousel, CarouselContent, CarouselItem } from './ui/carousel';
import { Button } from './ui/button';
import { getBanners } from '../services/bannerService';

// Mock banner data
const mockBanners = [
  {
    id: '1',
    image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200',
    title: 'Canlı Bahis Heyecanı',
    subtitle: 'En yüksek oranlarla canlı maçlara bahis yapın. Anında ödemeler, güvenli platform.',
    link_url: '/live',
    button_text: 'Canlı Maçlar',
    is_active: true,
    order: 1,
  },
  {
    id: '2',
    image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200',
    title: 'Binlerce Maç Seçeneği',
    subtitle: 'Futboldan basketbola, tüm spor dallarında yüksek oranlar ve hızlı bahis deneyimi.',
    link_url: '/matches',
    button_text: 'Tüm Maçlar',
    is_active: true,
    order: 2,
  },
  {
    id: '3',
    image_url: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200',
    title: 'Güvenli ve Hızlı',
    subtitle: '7/24 destek, anında para yatırma ve çekme imkanı ile kesintisiz bahis deneyimi.',
    link_url: '/dashboard',
    button_text: 'Hemen Başla',
    is_active: true,
    order: 3,
  },
];

const HeroBannerSlider = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);
  const [api, setApi] = useState(null);
  const autoplayIntervalRef = useRef(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const data = await getBanners(true);
        if (data && data.length > 0) {
          setBanners(data);
          setUseMockData(false);
        } else {
          // If no banners in database, use mock data
          setBanners(mockBanners);
          setUseMockData(true);
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
        // If API fails, use mock data
        setBanners(mockBanners);
        setUseMockData(true);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (!api || banners.length <= 1) return;

    // Auto-advance every 5 seconds
    autoplayIntervalRef.current = setInterval(() => {
      api.scrollNext();
    }, 5000);

    return () => {
      if (autoplayIntervalRef.current) {
        clearInterval(autoplayIntervalRef.current);
      }
    };
  }, [api, banners.length]);

  if (loading) {
    return (
      <div className="relative w-full rounded-lg sm:rounded-xl lg:rounded-2xl bg-gradient-to-r from-[#1a2332] to-[#0d1117] border border-[#1e2736] animate-pulse" style={{ height: '210px' }}>
        <div className="md:h-48 lg:h-64 xl:h-80 2xl:h-96" style={{ height: '210px' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-500">Yükleniyor...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!banners || banners.length === 0) {
    // Fallback banner if no banners in database
    return (
      <div className="relative w-full overflow-hidden rounded-lg sm:rounded-xl lg:rounded-2xl bg-gradient-to-r from-amber-600/20 via-[#1a2332] to-[#0d1117] border border-amber-500/20" style={{ height: '210px' }}>
        <div className="md:h-48 lg:h-64 xl:h-80 2xl:h-96" style={{ height: '210px' }}>
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1200')] bg-cover bg-center opacity-10"></div>
          <div className="relative h-full flex items-center p-4 sm:p-6 md:p-8 lg:p-12">
            <div className="max-w-xl">
              <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1.5 sm:mb-2 md:mb-3">
                Canlı Bahis Heyecanı
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm md:text-base mb-3 sm:mb-4 md:mb-6 leading-relaxed">
                En yüksek oranlarla canlı maçlara bahis yapın. Anında ödemeler, güvenli platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <Carousel
        setApi={setApi}
        className="w-full"
        opts={{
          align: "start",
          loop: true,
        }}
      >
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-0">
              <div className="relative w-full overflow-hidden rounded-lg sm:rounded-xl lg:rounded-2xl bg-gradient-to-r from-[#1a2332] to-[#0d1117] border border-[#1e2736] h-[210px] md:h-48 lg:h-64 xl:h-80 2xl:h-96">
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${banner.image_url})`,
                    opacity: 0.3,
                  }}
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117]/90 via-[#0d1117]/70 to-transparent" />
                
                {/* Content */}
                <div className="relative h-full flex items-center p-4 sm:p-6 md:p-8 lg:p-12">
                  <div className="max-w-xl space-y-3 sm:space-y-4 md:space-y-6">
                    {banner.title && (
                      <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-tight">
                        {banner.title}
                      </h1>
                    )}
                    {banner.subtitle && (
                      <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg leading-relaxed max-w-2xl">
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.link_url && banner.button_text && (
                      <div className="pt-2 sm:pt-4">
                        <Link to={banner.link_url}>
                          <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-xs sm:text-sm md:text-base h-9 sm:h-10 md:h-11 px-4 sm:px-6">
                            {banner.button_text}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default HeroBannerSlider;

