export interface UserProfile {
  id: string;
  name: string;
  title?: string;
  email: string;
}

export function renderProfile(profile: UserProfile): string {
  if (!profile.email.includes('@')) {
    throw new Error('Invalid email');
  }

  return `
    <div class="user-profile">
      <h1>${profile.name}</h1>
      ${profile.title ? `<p>${profile.title}</p>` : ''}
      <a href="mailto:${profile.email}">${profile.email}</a>
    </div>
  `;
}

export function fetchProfile(id: string): Promise<UserProfile> {
  return Promise.resolve({
    id,
    name: 'Demo User',
    title: 'Engineer',
    email: 'demo@example.com'
  });
}
