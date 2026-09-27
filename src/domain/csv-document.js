// forScore metadata CSV parsing and serialization. Strict: malformed input is rejected
// so an import never partially replaces a library.

import Papa from 'papaparse';

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const VALIDATED_ROW_TARGET = 5000;
export const MAX_IMPORT_ROWS = 25000;

export function getTextByteLength(text) {
    return new TextEncoder().encode(text).byteLength;
}

export function parseCsvDocument(text) {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('No data found in CSV. Please check the file format.');
    }

    const parsed = Papa.parse(text, {
        delimiter: ',',
        skipEmptyLines: 'greedy'
    });

    if (parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        const rowLabel = Number.isInteger(firstError.row) ? ` on row ${firstError.row + 1}` : '';
        throw new Error(`Invalid CSV${rowLabel}: ${firstError.message}`);
    }

    if (parsed.data.length < 2) {
        throw new Error('No data found in CSV. Please check the file format.');
    }

    const headers = parsed.data[0].map((value, index) => {
        const header = String(value ?? '').replace(/^\uFEFF/, '').trim();
        if (!header) throw new Error(`Invalid CSV: column ${index + 1} has no header.`);
        return header;
    });

    if (new Set(headers).size !== headers.length) {
        throw new Error('Invalid CSV: duplicate column headers are not supported.');
    }

    const rows = parsed.data.slice(1).map((values, index) => {
        if (values.length !== headers.length) {
            throw new Error(
                `Invalid CSV on row ${index + 2}: expected ${headers.length} columns but found ${values.length}.`
            );
        }

        return Object.fromEntries(headers.map((header, columnIndex) => [
            header,
            String(values[columnIndex] ?? '')
        ]));
    });

    return { headers, rows };
}

export function serializeCsvDocument(headers, rows) {
    return Papa.unparse({
        fields: headers,
        data: rows.map(row => headers.map(header => String(row[header] ?? '')))
    }, {
        newline: '\r\n'
    });
}

export function buildExportFilename(sourceFileName = 'forscore-library.csv', date = new Date()) {
    const sourceBase = sourceFileName.replace(/\.csv$/i, '')
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'forscore-library';
    const dateStamp = date.toISOString().slice(0, 10);
    return `${sourceBase}-tidyscore-${dateStamp}.csv`;
}

export const SAMPLE_LIBRARY_CSV = [
    'Title,Composers,Genre,Tags,Filename',
    'Bach - Cello Suite No. 1 in G Major,,Baroque,cello,Bach - Cello Suite No.1 in G Major.pdf',
    'Prelude in C Major,bach,Baroque,piano;keyboard,Bach - Prelude in C Major BWV 846.pdf',
    'Moonlight Sonata,beethoven,Classical,piano,Moonlight Sonata.pdf',
    'Moonlight Sonata (2),"Beethoven, Ludwig van",Classical,piano,Moonlight Sonata copy.pdf',
    '"Symphony No. 5, Op. 67",Ludwig van Beethoven,Classical,orchestra,Beethoven Symphony No.5 Op.67.pdf',
    'Clair de Lune,Debussy,Romantic,piano,Clair de Lune.pdf',
    'The Four Seasons - Spring,vivaldi ,Baroque,violin;ensemble,The Four Seasons - Spring.pdf',
    '"Nocturne Op. 9, No. 2",chopin,Romantic,piano,"Nocturne Op. 9, No. 2.pdf"',
    'Hungarian Rhapsody No. 2, ,Romantic,piano,Hungarian Rhapsody No. 2.pdf',
    'Ave Maria," Schubert, Franz ",Classical,vocal,Ave Maria.pdf',
    'Gymnopédie No. 1,Erik Satie,Modern,piano,Gymnopédie No. 1.pdf',
    'Canon in D,Pachelbel,Baroque,ensemble,Canon in D.pdf',
    'Für Elise,beethoven,Classical,piano,Für Elise.pdf',
    '"IMSLP00001-Beethoven - Piano Sonata No.8, Op.13",,Classical,piano,"IMSLP00001-Beethoven - Piano Sonata No.8, Op.13.pdf"',
    'Rêverie,debussy,Romantic,piano,Rêverie.pdf',
    'Boléro,ravel,Modern,orchestra,Boléro.pdf',
    'Träumerei,Robert Schumann,Romantic,piano,Träumerei.pdf',
    'Liebestraum No. 3,liszt,Romantic,piano,Liebestraum No. 3.pdf',
    'The Nutcracker Suite,tchaikovsky,Romantic,orchestra,The Nutcracker Suite.pdf',
    'New World Symphony,dvorak,Romantic,orchestra;symphony,New World Symphony.pdf',
    'Piano Concerto No. 2,rachmaninoff,Romantic,piano;orchestra,Piano Concerto No. 2.pdf',
    'C.P.E. Bach - Solfeggietto in C Minor,,Baroque,keyboard;study,C.P.E. Bach - Solfeggietto in C Minor.pdf',
    'Solfeggietto in C Minor,cpe bach,Baroque,keyboard,Solfeggietto in C Minor.pdf',
    '"Clara Schumann - Romance in A Minor, Op. 21 No. 1",,Romantic,piano,"Romance in A Minor, Op.21 No.1.pdf"',
    '"Romance in A Minor, Op. 21 No. 1",clara schumann,Romantic,piano,"Romance in A Minor, Op.21 No.1 (scan).pdf"',
    'J.S. Bach: Invention No. 1 in C Major,,Baroque,piano;pedagogy,J.S. Bach: Invention No. 1 in C Major.pdf',
    'WTC Book I - Prelude and Fugue in C major (Bach),,Baroque,piano,WTC Book I - Prelude and Fugue in C major (Bach).pdf',
    'Haydn - Cello Concerto No. 1 in C Major,,Classical,cello;orchestra,Haydn - Cello Concerto No. 1 in C Major.pdf',
    '"Mozart: Sonata in C Major, K.545",,Classical,piano,Sonata in C Major K545.pdf',
    'Sonata in C Major K.545,m0zart,Classical,piano,Sonata in C Major K545.pdf',
    'Rachmaninoff - Vocalise Op.34 No.14,,Romantic,voice;violin,Rachmaninoff - Vocalise Op.34 No.14.pdf',
    'Mahler: Symphony No. 5 - Adagietto,,Romantic,orchestra,Mahler: Symphony No. 5 - Adagietto.pdf',
    'Gershwin - Rhapsody in Blue,,Jazz,piano;orchestra,Gershwin - Rhapsody in Blue.pdf',
    'Scott Joplin - The Entertainer,,Ragtime,piano,Scott Joplin - The Entertainer.pdf',
    'Piazzolla: Libertango,,Contemporary,tango;ensemble,Piazzolla: Libertango.pdf',
    'Arvo Pärt - Spiegel im Spiegel,,Neo-Classical,violin;piano,Arvo Pärt - Spiegel im Spiegel.pdf',
    'Hans Zimmer - Time,,Film,piano,Hans Zimmer - Time.pdf',
    'Yiruma - River Flows in You,,Contemporary,piano,Yiruma - River Flows in You.pdf',
    'Satie: Gnossienne No. 1,,Modern,piano,Satie: Gnossienne No. 1.pdf',
    'Debussy Arabesque No.1,debussy,Impressionist,piano,Debussy Arabesque No.1.pdf',
    'Prokofiev: Dance of the Knights,,20th Century,orchestra,Prokofiev: Dance of the Knights.pdf',
    '"Intermezzo for Piano, Op. 118 No. 2",Johannes Brahms,Romantic,piano,Intermezzo piano op 118 no 2.pdf',
    '"Intermezzo, Op. 118 No. 2",brahms,Romantic,piano,Intermezzo alternate scan.pdf',
    'Academic Festival Overture Full Score,Johannes Brahms,Romantic,orchestra,Academic Festival Overture score.pdf',
    'Academic Festival Overture Violin Part,Johannes Brahms,Romantic,violin;orchestra,Academic Festival Overture violin part.pdf',
    'Brahms and Beethoven - Variations,,,piano,Brahms Beethoven Variations.pdf',
    'C.P.E. Bach and J.S. Bach - Two Bachs,,Baroque,keyboard,CPE and JS Bach.pdf',
    'Piano Miniatures Brahms Kapustin Beethoven,,,piano,Brahms Kapustin Beethoven Miniatures.pdf',
    'Slavonic Dances,"Antonin Dvorak, Johannes Brahms",Romantic,piano;four hands,Slavonic Dances four hands.pdf'
].join('\n');
