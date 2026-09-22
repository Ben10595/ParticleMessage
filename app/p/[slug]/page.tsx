import ParticleExperience from '@/components/erlebnis/ParticleExperience';
export default async function MessagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ParticleExperience slug={slug} />;
}
