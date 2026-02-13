
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://kjebadvveghiahmiqnin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZWJhZHZ2ZWdoaWFobWlxbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjAxNTcsImV4cCI6MjA4NTg5NjE1N30.7GjIWOg_Ow9nLscnEY5fqVez2kBcF4PTRT9MO0LwKzE';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data } = await supabase.from('products').select('name, category, site, id');
    console.log("--- START ---");
    data.forEach(p => {
        console.log(`[${p.site}] ${p.name} | Cat: ${p.category} | ID prefix: ${p.id.slice(0, 8)}`);
    });
    console.log("--- END ---");
}
check();
