import { cookies } from 'next/headers';
import ParticleExperience from '@/components/ParticleExperience';
import PasswordGate from '@/components/PasswordGate';
import { ACCESS_COOKIE, sessionTokenMatches } from '@/lib/passwordAuth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sessionSecret = process.env.PARTICLE_MESSAGE_SESSION_SECRET;
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  const authenticated = Boolean(sessionSecret && sessionTokenMatches(token, sessionSecret));

  return authenticated ? <ParticleExperience /> : <PasswordGate />;
}
