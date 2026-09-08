import type { Metadata } from "next";
import { PolicyLayout } from "@/components/PolicyLayout";

export const metadata: Metadata = { title: "Shipping Policy" };

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout kicker="Shipping information" title="Shipping Policy" updated="June 2026">
      <h2>Order Processing</h2>
      <p>
        Orders are typically processed within 1–3 business days after payment
        confirmation. Processing times may vary during periods of high demand,
        holidays, or special promotions.
      </p>
      <h2>Shipping Timeframes</h2>
      <p>
        Delivery times vary depending on the destination and shipping method
        selected at checkout. Estimated delivery dates are provided for
        reference only and are not guaranteed.
      </p>
      <h2>Shipping Confirmation</h2>
      <p>
        Once an order has been processed and dispatched, customers may receive
        shipping confirmation and tracking information when available through
        the selected carrier.
      </p>
      <h2>Incorrect Shipping Information</h2>
      <p>
        Customers are responsible for ensuring that shipping information is
        accurate and complete at the time of purchase. Redline Labs is not
        responsible for delays or losses resulting from incorrect address
        information provided during checkout.
      </p>
      <h2>Delivery Delays</h2>
      <p>
        Delivery delays may occur due to carrier disruptions, weather
        conditions, customs processing, peak shipping seasons, or circumstances
        beyond our control.
      </p>
      <h2>Lost or Damaged Packages</h2>
      <p>
        If your package arrives damaged or appears lost during transit, please
        contact us promptly so we can review the situation and assist where
        possible.
      </p>
      <h2>International Shipping</h2>
      <p>
        International shipments may be subject to customs inspections, duties,
        taxes, and import regulations imposed by the destination country.
        Customers are responsible for any applicable fees or requirements.
      </p>
      <h2>Contact Us</h2>
      <p>
        If you have questions regarding your shipment or delivery status,
        please contact our support team through our Contact Us page.
      </p>
    </PolicyLayout>
  );
}
