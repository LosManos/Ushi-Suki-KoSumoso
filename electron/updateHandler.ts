export async function checkUpdate(currentVersion: string): Promise<any> {
    try {
        const response = await fetch('https://api.github.com/repos/LosManos/Ushi-Suki-KoSumoso/releases/latest', {
            headers: { 'User-Agent': 'Kosumoso-App' }
        });

        if (!response.ok) {
            return { error: `GitHub API returned ${response.status}` };
        }

        const release = await response.json();
        const latestVersion = release.tag_name.replace(/^v/, '');

        // Simple version comparison (semantic)
        const latest = latestVersion.split('.').map(Number);
        const current = currentVersion.split('.').map(Number);

        let isNewer = false;
        for (let i = 0; i < 3; i++) {
            if ((latest[i] || 0) > (current[i] || 0)) {
                isNewer = true;
                break;
            }
            if ((latest[i] || 0) < (current[i] || 0)) {
                break;
            }
        }

        return {
            isNewer,
            latestVersion,
            currentVersion,
            url: release.html_url,
            publishedAt: release.published_at
        };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getReleases(): Promise<any> {
    try {
        const response = await fetch('https://api.github.com/repos/LosManos/Ushi-Suki-KoSumoso/releases', {
            headers: { 'User-Agent': 'Kosumoso-App' }
        });

        if (!response.ok) {
            return { error: `GitHub API returned ${response.status}` };
        }

        const releases = await response.json();
        return releases.map((r: any) => ({
            version: r.tag_name.replace(/^v/, ''),
            date: r.published_at.split('T')[0],
            body: r.body,
            url: r.html_url
        }));
    } catch (e: any) {
        return { error: e.message };
    }
}
