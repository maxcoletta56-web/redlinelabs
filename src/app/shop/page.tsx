import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { ShopCatalog } from "@/components/ShopCatalog";

export default function ShopPage() {
  return (
    <div className="wrap py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Catalogue" }]} />
      <ResearchDisclaimer className="mb-10" />
      <ShopCatalog />
    </div>
  );
}
