import EnrollButton from "@/components/EnrollButton";
import { Check } from "lucide-react";

export default function SubscribePage() {
  const perks = [
    "Access to all premium courses",
    "Interactive code exercises",
    "24/7 AI Teaching Assistant",
    "Certificate of completion",
    "Community access",
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Get Unlimited Access
        </h2>
        <p className="mt-4 text-lg text-gray-500">
          Unlock everything on Aavitam Teach with a simple monthly subscription.
        </p>
      </div>

      <div className="mt-16 max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Monthly Plan</h3>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
              Best Value
            </span>
          </div>
          <div className="mt-4 flex items-baseline">
            <span className="text-5xl font-extrabold tracking-tight text-gray-900">
              $19.99
            </span>
            <span className="ml-1 text-xl font-semibold text-gray-500">/mo</span>
          </div>
          <p className="mt-6 text-gray-500">
            Perfect for dedicated learners who want to master coding quickly.
          </p>

          <ul className="mt-8 space-y-4">
            {perks.map((perk, idx) => (
              <li key={idx} className="flex items-start">
                <div className="flex-shrink-0">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <p className="ml-3 text-sm text-gray-700">{perk}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <EnrollButton isSubscription={true} />
          </div>
          <p className="mt-4 text-center text-xs text-gray-500">
            Cancel anytime. No hidden fees.
          </p>
        </div>
      </div>
    </div>
  );
}
