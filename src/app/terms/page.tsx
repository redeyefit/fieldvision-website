import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | FieldVision AI',
  description: 'FieldVision AI Terms of Service.',
};

export default function TermsPage() {
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
        <h1 className="font-display text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-fv-gray-400 mb-12">Last updated: December 25, 2025</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-fv-gray-300 mb-6">
            Welcome to FieldVision. By downloading, installing, or using our application, you agree to be bound by these Terms of Service (&quot;Terms&quot;). Please read them carefully.
          </p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">1. Acceptance of Terms</h2>
          <p className="text-fv-gray-300">By accessing or using FieldVision, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the app.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">2. Description of Service</h2>
          <p className="text-fv-gray-300">FieldVision is a mobile application that helps construction professionals create daily reports using AI-powered analysis of photos, videos, and voice notes. The app generates reports based on the content you provide.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">3. Your Content</h2>
          <p className="text-fv-gray-300 mb-4">You retain ownership of all photos, videos, voice recordings, and other content you create using FieldVision (&quot;Your Content&quot;). By using the app, you grant us a limited license to process Your Content solely for the purpose of providing the service (e.g., AI analysis for report generation).</p>
          <p className="text-fv-gray-300">You are responsible for ensuring you have the right to capture and use any content you add to FieldVision, including photos of job sites.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">4. AI-Generated Reports</h2>
          <p className="text-fv-gray-300 mb-4">FieldVision uses artificial intelligence to analyze your content and generate daily reports. You acknowledge that:</p>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li>AI-generated content should be reviewed before use or submission</li>
            <li>You are responsible for verifying the accuracy of generated reports</li>
            <li>AI may occasionally produce errors or inaccuracies</li>
            <li>Final reports should be reviewed and approved by qualified personnel</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">5. Acceptable Use</h2>
          <p className="text-fv-gray-300 mb-4">You agree not to:</p>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li>Use FieldVision for any illegal purpose</li>
            <li>Attempt to reverse engineer or extract source code from the app</li>
            <li>Use the app to harass, abuse, or harm others</li>
            <li>Upload content that infringes on intellectual property rights</li>
            <li>Attempt to circumvent any security features</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">6. Subscription and Payments</h2>
          <p className="text-fv-gray-300 mb-4">FieldVision may offer free and paid subscription tiers. Payment terms:</p>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li>Subscriptions are billed through the Apple App Store</li>
            <li>Prices are subject to change with notice</li>
            <li>Refunds are handled according to Apple&apos;s refund policies</li>
            <li>You can cancel your subscription at any time through your Apple ID settings</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">7. Disclaimer of Warranties</h2>
          <p className="text-fv-gray-300 mb-4">FIELDVISION IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. We do not warrant that:</p>
          <ul className="list-disc list-outside ml-6 text-fv-gray-300 space-y-2">
            <li>The app will be uninterrupted or error-free</li>
            <li>AI-generated reports will be completely accurate</li>
            <li>The app will meet all your requirements</li>
          </ul>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">8. Limitation of Liability</h2>
          <p className="text-fv-gray-300 mb-4">TO THE MAXIMUM EXTENT PERMITTED BY LAW, FIELDVISION AND ITS CREATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.</p>
          <p className="text-fv-gray-300">Our total liability for any claims arising from your use of FieldVision shall not exceed the amount you paid for the app in the 12 months preceding the claim.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">9. Indemnification</h2>
          <p className="text-fv-gray-300">You agree to indemnify and hold harmless FieldVision and its creators from any claims, damages, or expenses arising from your use of the app or violation of these Terms.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">10. Changes to Terms</h2>
          <p className="text-fv-gray-300">We may modify these Terms at any time. We will notify you of material changes through the app or by updating the &quot;Last updated&quot; date. Continued use of FieldVision after changes constitutes acceptance of the new Terms.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">11. Termination</h2>
          <p className="text-fv-gray-300">We may terminate or suspend your access to FieldVision at any time for violation of these Terms. You may stop using the app at any time by uninstalling it.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">12. Governing Law</h2>
          <p className="text-fv-gray-300">These Terms are governed by the laws of the State of California, United States, without regard to conflict of law principles.</p>

          <h2 className="font-display text-2xl font-semibold text-fv-blue mt-10 mb-4">13. Contact</h2>
          <p className="text-fv-gray-300">For questions about these Terms, contact us at:</p>
          <p className="mt-2">
            <a href="mailto:legal@getfieldvision.ai" className="text-fv-blue hover:underline">
              legal@getfieldvision.ai
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
