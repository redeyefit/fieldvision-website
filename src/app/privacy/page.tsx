import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | FieldVision AI',
  description: 'FieldVision AI Privacy Policy - How we handle your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-fv-black text-white">
      {/* Navigation */}
      <nav className="px-6 md:px-12 py-6 flex justify-between items-center border-b border-fv-gray-800">
        <Link href="/" className="font-display font-semibold text-xl">
          FieldVision
        </Link>
        <Link href="/" className="text-fv-gray-400 hover:text-white transition-colors">
          Back to Home
        </Link>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-fv-gray-400 mb-12">Last updated: December 25, 2025</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-fv-gray-300 mb-6">
            FieldVision (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.
          </p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Information We Collect</h2>

          <h3 className="font-display text-lg font-semibold mt-6 mb-2">Data You Provide</h3>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li><strong className="text-white">Photos and Videos:</strong> Construction site images and videos you capture for daily reports</li>
            <li><strong className="text-white">Voice Recordings:</strong> Audio notes you record, which are transcribed locally on your device</li>
            <li><strong className="text-white">Project Information:</strong> Project names, addresses, client names, and notes you enter</li>
            <li><strong className="text-white">Text Notes:</strong> Written observations and comments you add to logs</li>
          </ul>

          <h3 className="font-display text-lg font-semibold mt-6 mb-2">Automatically Collected Data</h3>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li><strong className="text-white">Location Data (Optional):</strong> Used only to fetch weather information for your jobsite. You can deny location access and the app will still function.</li>
            <li><strong className="text-white">Device Information:</strong> Basic device identifiers for crash reporting and app improvement</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">How We Use Your Information</h2>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li><strong className="text-white">AI Analysis:</strong> Photos and text are sent to AI services (Google Gemini, Anthropic Claude) to generate daily reports. These services process your data but do not retain it for training.</li>
            <li><strong className="text-white">Weather Data:</strong> Your location (if permitted) is used to fetch current weather conditions for report accuracy.</li>
            <li><strong className="text-white">App Improvement:</strong> Anonymized crash reports help us fix bugs and improve the app.</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Data Storage</h2>
          <p className="text-fv-gray-300 mb-4">Your data is stored:</p>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li><strong className="text-white">Locally on your device:</strong> All photos, videos, voice recordings, and project data are stored on your iPhone.</li>
            <li><strong className="text-white">iCloud (your account):</strong> If you have iCloud enabled, data syncs to your personal iCloud account for backup and multi-device access. We do not have access to your iCloud data.</li>
          </ul>
          <p className="text-fv-gray-300 mt-4">We do not maintain servers that store your construction data. Your information stays on your device and your iCloud account.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Third-Party Services</h2>
          <p className="text-fv-gray-300 mb-4">FieldVision uses the following third-party services:</p>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li><strong className="text-white">Google Gemini API:</strong> For photo analysis and report generation. Images are processed but not retained. <a href="https://ai.google.dev/terms" target="_blank" rel="noopener noreferrer" className="text-fv-blue hover:underline">Google AI Terms</a></li>
            <li><strong className="text-white">Anthropic Claude API:</strong> For text synthesis and report formatting. Data is processed but not used for training. <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-fv-blue hover:underline">Anthropic Privacy Policy</a></li>
            <li><strong className="text-white">Apple Services:</strong> iCloud sync, crash reporting, and App Store services are governed by Apple&apos;s privacy policy.</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">What We Don&apos;t Do</h2>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li>We do not sell your data to third parties</li>
            <li>We do not use your data for advertising</li>
            <li>We do not require account creation or collect your email (unless you contact support)</li>
            <li>We do not track your location continuously</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Data Retention</h2>
          <p className="text-fv-gray-300">Your data remains on your device until you delete it. You can delete individual logs, entire projects, or all app data at any time through the app or by uninstalling FieldVision.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Your Rights</h2>
          <p className="text-fv-gray-300 mb-4">You have the right to:</p>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li>Access all data stored in the app (it&apos;s on your device)</li>
            <li>Delete any or all of your data at any time</li>
            <li>Deny location permissions while still using core features</li>
            <li>Contact us with questions about your data</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Children&apos;s Privacy</h2>
          <p className="text-fv-gray-300">FieldVision is designed for construction professionals and is not intended for children under 13. We do not knowingly collect information from children.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Changes to This Policy</h2>
          <p className="text-fv-gray-300">We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">Contact Us</h2>
          <p className="text-fv-gray-300">If you have questions about this Privacy Policy, please contact us at:</p>
          <p className="mt-2">
            <a href="mailto:privacy@getfieldvision.ai" className="text-fv-blue hover:underline">
              privacy@getfieldvision.ai
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-fv-gray-800 py-8 text-center text-fv-gray-400">
        <p>&copy; 2025 FieldVision AI. All rights reserved.</p>
        <p className="mt-2">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          {' · '}
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
        </p>
      </footer>
    </div>
  );
}
