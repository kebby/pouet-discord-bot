// defitions for pouet.net API

interface Platform {
    name: string,
    icon: string,
    slug: string,
}

interface Platforms {
    [id: number]: Platform,
}

interface Party {
    id: string,
    name: string,
    web: string,
    addedDate?: string,
    addedUser?: string,
}

interface PartyResult {
    success: boolean,
    party: Party,
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

interface Link {
    type: string,
    link: string,
}

interface Credit {
    user: User,
    role: string,
}

interface Prod {
    types: string[],
    platforms: Platforms,
    placings: Placing[],
    groups: Group[],
    awards: Array<object>,
    id: string,
    name: string,
    addedDate: string,
    releaseDate: string,
    voteup: string,
    votepig: string,
    votedown: string,
    voteavg: string,
    download: string,
    addeduser: User,
    sceneorg: string,
    demozoo: string,
    zxdemo: string,
    invitation?: string,
    invitationyear?: string,
    boardID?: object,
    rank: string,
    cdc: number,
    downloadLinks: Link[],
    credits: Credit[],
    screenshot: string,
}


interface ProdResult {
    success: boolean,
    prod: Prod,
}

interface RankedProd {
    rank: number,
    prod: Prod,
}

interface RankedResult {
    success: boolean,
    prods: RankedProd[],
}