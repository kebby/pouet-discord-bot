// defitions for pouet.net API

interface Platform {
    name: string,
    icon: string,
    slug: string,
}

interface Platforms {
    [id: string]: Platform,
}

interface Party {
    id: string,
    name: string,
    web: string,
}

interface Placing {
    party: Party,
    compo: string,
    ranking: string,
    year: string,
    compo_name: string,
}

interface Group {
    id: string,
    name: string,
    acronym: string,
    disambiguation: string,
    web: string,
    addedUser: string,
    addedDate: string,
}

interface User {
    id: string,
    nickname: string,
    level: string,
    avatar: string,
    glops: string,
    registerDate: string,
} 

interface Prod {
    types: string[],
    platforms: Platforms,
    placings: Placing[],
    groups: Group[],
    awards: Array<object>,
    id: string,
    name: string,
    type: string,
    addedDate: string,
    releaseDate: string,
    voteup: string,
    votepig: string,
    votedown: string,
    voteavg: string,
    download: string,
    addeduser: User,
    cdc: number,
    screenshot: string,
}

interface RankedProd {
    rank: number,
    prod: Prod,
}

interface RankedResult {
    success: boolean,
    prods: RankedProd[],
}