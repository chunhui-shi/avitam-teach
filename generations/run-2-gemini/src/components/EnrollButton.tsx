"use client";

import { useState } from "react";
import axios from "axios";
import { useSession, signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

interface EnrollButtonProps {
  courseId?: string;
  isSubscription?: boolean;
}

export default function EnrollButton({ courseId, isSubscription }: EnrollButtonProps) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
      if (!session) {
        signIn();
        return;
      }

      setIsLoading(true);

      const response = await axios.post("/api/stripe/checkout", {
        courseId,
        isSubscription,
      });

      window.location.assign(response.data.url);
    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isSubscription ? (
        "Subscribe Now"
      ) : (
        "Enroll Now"
      )}
    </button>
  );
}
