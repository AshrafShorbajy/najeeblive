import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

export const ALL_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "دولار أمريكي", symbol: "$" },
  { code: "EUR", name: "يورو", symbol: "€" },
  { code: "GBP", name: "جنيه إسترليني", symbol: "£" },
  { code: "SAR", name: "ريال سعودي", symbol: "ر.س" },
  { code: "AED", name: "درهم إماراتي", symbol: "د.إ" },
  { code: "KWD", name: "دينار كويتي", symbol: "د.ك" },
  { code: "BHD", name: "دينار بحريني", symbol: "د.ب" },
  { code: "OMR", name: "ريال عماني", symbol: "ر.ع" },
  { code: "QAR", name: "ريال قطري", symbol: "ر.ق" },
  { code: "EGP", name: "جنيه مصري", symbol: "ج.م" },
  { code: "JOD", name: "دينار أردني", symbol: "د.أ" },
  { code: "IQD", name: "دينار عراقي", symbol: "د.ع" },
  { code: "LBP", name: "ليرة لبنانية", symbol: "ل.ل" },
  { code: "MAD", name: "درهم مغربي", symbol: "د.م" },
  { code: "TND", name: "دينار تونسي", symbol: "د.ت" },
  { code: "DZD", name: "دينار جزائري", symbol: "د.ج" },
  { code: "LYD", name: "دينار ليبي", symbol: "د.ل" },
  { code: "SDG", name: "جنيه سوداني", symbol: "ج.س" },
  { code: "YER", name: "ريال يمني", symbol: "ر.ي" },
  { code: "SYP", name: "ليرة سورية", symbol: "ل.س" },
  { code: "TRY", name: "ليرة تركية", symbol: "₺" },
  { code: "INR", name: "روبية هندية", symbol: "₹" },
  { code: "PKR", name: "روبية باكستانية", symbol: "₨" },
  { code: "CNY", name: "يوان صيني", symbol: "¥" },
  { code: "JPY", name: "ين ياباني", symbol: "¥" },
  { code: "KRW", name: "وون كوري", symbol: "₩" },
  { code: "MYR", name: "رينغيت ماليزي", symbol: "RM" },
  { code: "IDR", name: "روبية إندونيسية", symbol: "Rp" },
  { code: "THB", name: "بات تايلاندي", symbol: "฿" },
  { code: "PHP", name: "بيزو فلبيني", symbol: "₱" },
  { code: "SGD", name: "دولار سنغافوري", symbol: "S$" },
  { code: "HKD", name: "دولار هونغ كونغ", symbol: "HK$" },
  { code: "AUD", name: "دولار أسترالي", symbol: "A$" },
  { code: "NZD", name: "دولار نيوزيلندي", symbol: "NZ$" },
  { code: "CAD", name: "دولار كندي", symbol: "C$" },
  { code: "CHF", name: "فرنك سويسري", symbol: "CHF" },
  { code: "SEK", name: "كرونة سويدية", symbol: "kr" },
  { code: "NOK", name: "كرونة نرويجية", symbol: "kr" },
  { code: "DKK", name: "كرونة دنماركية", symbol: "kr" },
  { code: "PLN", name: "زلوتي بولندي", symbol: "zł" },
  { code: "CZK", name: "كرونة تشيكية", symbol: "Kč" },
  { code: "HUF", name: "فورنت مجري", symbol: "Ft" },
  { code: "RON", name: "ليو روماني", symbol: "lei" },
  { code: "BGN", name: "ليف بلغاري", symbol: "лв" },
  { code: "HRK", name: "كونا كرواتية", symbol: "kn" },
  { code: "RUB", name: "روبل روسي", symbol: "₽" },
  { code: "UAH", name: "هريفنا أوكرانية", symbol: "₴" },
  { code: "BRL", name: "ريال برازيلي", symbol: "R$" },
  { code: "MXN", name: "بيزو مكسيكي", symbol: "MX$" },
  { code: "ARS", name: "بيزو أرجنتيني", symbol: "AR$" },
  { code: "CLP", name: "بيزو تشيلي", symbol: "CL$" },
  { code: "COP", name: "بيزو كولومبي", symbol: "CO$" },
  { code: "ZAR", name: "راند جنوب أفريقي", symbol: "R" },
  { code: "NGN", name: "نيرة نيجيرية", symbol: "₦" },
  { code: "KES", name: "شلن كيني", symbol: "KSh" },
  { code: "GHS", name: "سيدي غاني", symbol: "₵" },
];

interface CurrencySettings {
  activeCurrency: string;
  exchangeRate: number; // how many units of active currency = 1 USD
}

interface CurrencyContextType {
  currency: CurrencyInfo;
  exchangeRate: number;
  /** Convert USD price to display currency */
  convert: (usdPrice: number) => number;
  /** Format price with currency symbol */
  format: (usdPrice: number) => string;
  /** Format already-converted price */
  formatRaw: (price: number) => string;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: ALL_CURRENCIES[0],
  exchangeRate: 1,
  convert: (p) => p,
  format: (p) => `$${p}`,
  formatRaw: (p) => `$${p}`,
  loading: true,
});

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CurrencySettings>({ activeCurrency: "USD", exchangeRate: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "currency_settings").maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          const v = data.value as any;
          setSettings({
            activeCurrency: v.activeCurrency || "USD",
            exchangeRate: v.exchangeRate || 1,
          });
        }
        setLoading(false);
      });
  }, []);

  const currency = ALL_CURRENCIES.find(c => c.code === settings.activeCurrency) || ALL_CURRENCIES[0];
  const rate = settings.exchangeRate;

  const convert = (usdPrice: number) => {
    if (settings.activeCurrency === "USD") return usdPrice;
    return Math.round(usdPrice * rate * 100) / 100;
  };

  const format = (usdPrice: number) => {
    const converted = convert(usdPrice);
    return `${converted} ${currency.symbol}`;
  };

  const formatRaw = (price: number) => `${price} ${currency.symbol}`;

  return (
    <CurrencyContext.Provider value={{ currency, exchangeRate: rate, convert, format, formatRaw, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}
