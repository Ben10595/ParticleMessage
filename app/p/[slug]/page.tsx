import ParticleExperience from '@/components/ParticleExperience';
export default async function MessagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ParticleExperience slug={slug} />;
}
