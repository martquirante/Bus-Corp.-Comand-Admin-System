import { DigitalIdPageClient } from "@/features/employees/DigitalIdPageClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DigitalIdRoute({ params }: Props) {
  const { id } = await params;
  return <DigitalIdPageClient employeeId={id} />;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Digital ID — ${id} | POS Bus Ticketing`
  };
}
