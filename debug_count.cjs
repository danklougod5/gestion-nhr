
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kjebadvveghiahmiqnin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZWJhZHZ2ZWdoaWFobWlxbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjAxNTcsImV4cCI6MjA4NTg5NjE1N30.7GjIWOg_Ow9nLscnEY5fqVez2kBcF4PTRT9MO0LwKzE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCounts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('site, category, name');

        if (error) {
            console.log("Error:", error);
            return;
        }

        const counts = {};
        data.forEach(p => {
            const key = `${p.site} - ${p.category}`;
            if (!counts[key]) counts[key] = 0;
            counts[key]++;
        });

        console.log("Counts per Site-Category:");
        console.table(counts);

        // Also list non-archived products explicitly
        console.log("\nNon-archived products details:");
        data.filter(p => p.category !== 'ARCHIVED').forEach(p => {
            console.log(`[${p.site}] ${p.name} (${p.category})`);
        });

    } catch (e) {
        console.log("Exception:", e);
    }
}

checkCounts();
