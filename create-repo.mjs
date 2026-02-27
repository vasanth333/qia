import { config } from 'dotenv';
import { Octokit } from '@octokit/rest';
config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

try {
  const r = await octokit.rest.repos.createForAuthenticatedUser({
    name: 'qia',
    description: 'QIA — Quality Intelligence Agent: AI-powered QA automation',
    private: false,
    auto_init: false,
  });
  console.log('✅ Repo created:', r.data.html_url);
} catch (e) {
  if (e.status === 422) {
    console.log('ℹ️  Repo already exists — skipping creation');
  } else {
    console.error('ERROR:', e.status, e.message);
    process.exit(1);
  }
}
