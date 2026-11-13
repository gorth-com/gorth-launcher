import type { ReactNode } from "react";

interface PageBannerProps {
  image: string;
  children?: ReactNode;
}
import { Card, CardContent } from "@gorth-io/primitive/default/card";

export function PageBanner({ image, children }: PageBannerProps) {
  return (
    <Card className="overflow-hidden">
      <img src={image} alt="" className="h-48 w-full object-cover sm:h-64" />
      {children && (
        <CardContent className="flex flex-col gap-6">{children}</CardContent>
      )}
    </Card>
  );
}
