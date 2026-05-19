// ══════════════════════════════════════════════════════════════════════════
// Pilier educational content — long-form copy for the "Comprendre" screen.
//
// Structure per pilier:
//   hero_subtitle        : one-line poetic subtitle for the hero
//   anatomy              : array of paragraphs — anatomy + function
//   why_matters          : array of { icon, text } — everyday consequences
//   pilates_approach     : array of paragraphs — Pilates-specific approach
//   sabrina_quote        : short coach quote (placeholder, TODO Sabrina)
//   key_movements        : array of 5 fundamental movements with optional
//                          linked_session_id (`p2_3` style) when a séance
//                          maps to that movement
//   recommended_programs : 2-3 thematic programs for the pilier
//
// Linked session IDs follow the existing convention used by DownloadManager
// and getSignedVideoUrl: `${pilierKey}_${seanceIdx}` — same as the rest of
// the codebase.
//
// All ‟Sabrina quotes" below are placeholders written in her voice — the
// real recordings/quotes from Sabrina will replace them later. See the PR
// description for the full list to validate.
// ══════════════════════════════════════════════════════════════════════════

export const PILIER_CONTENT = {
  fr: {
    // ────────────────────────────────────────────────────────────────────
    // p1 — Épaules
    // ────────────────────────────────────────────────────────────────────
    p1: {
      hero_subtitle: "La porte ouverte sur ton monde",
      anatomy: [
        "L'épaule n'est pas qu'une articulation, c'est un orchestre. Trois os — l'omoplate, la clavicule, l'humérus — y dansent ensemble, soutenus par une vingtaine de muscles. C'est l'articulation la plus mobile du corps, et aussi la plus vulnérable.",
        "Au cœur de cet équilibre, la coiffe des rotateurs — quatre petits muscles profonds — stabilise la tête de l'humérus dans une cavité minuscule, à peine plus grande qu'une pièce de monnaie. Quand ces stabilisateurs s'endorment, ce sont les trapèzes et les muscles du cou qui prennent le relais. Et qui finissent par crier.",
        "L'omoplate, elle, devrait glisser librement sur la cage thoracique. Mais des heures passées devant un écran, les épaules en avant, transforment ce glissement fluide en frottement chronique. Le résultat : tensions, douleurs, raideurs qui remontent jusqu'à la nuque.",
        "Comprendre l'épaule, c'est comprendre que la liberté du bras commence dans le dos. Avant de lever, il faut stabiliser. Avant de pousser, il faut ancrer.",
      ],
      why_matters: [
        { icon: "lift", text: "Porter ses courses, soulever son enfant, attraper un objet en hauteur — tout passe par l'épaule. Une épaule libre, c'est une vie quotidienne sans douleur." },
        { icon: "office", text: "Huit heures par jour devant un écran enroulent les épaules vers l'avant. Sans réveil régulier des stabilisateurs, le corps oublie comment se tenir droit." },
        { icon: "sleep", text: "Dormir sur le côté avec une épaule tendue, c'est se réveiller avec une raideur qui pollue toute la journée." },
        { icon: "sport", text: "Du tennis au yoga, du golf à la natation, chaque geste précis dépend d'une épaule alignée. C'est le fondement de tout mouvement noble." },
      ],
      pilates_approach: [
        "Le Pilates aborde l'épaule par le détour. Au lieu de la renforcer frontalement comme une muscu classique, on commence par la libérer. On apprend à relâcher les trapèzes, à laisser l'omoplate descendre, à sentir le poids du bras avant de le mobiliser.",
        "Joseph Pilates l'avait compris : « Avant de bouger, il faut placer. » C'est dans cette précision que naît la force. Une épaule entraînée en Pilates n'est pas une épaule plus grosse — c'est une épaule plus juste.",
        "Tu vas sentir, dès les premières séances, une chose étrange : moins de tension dans le cou. C'est le signe que tes stabilisateurs se réveillent. Le mouvement devient plus libre, plus silencieux. L'épaule retrouve sa place naturelle.",
        "Le Pilates ne demande pas d'effort — il demande de l'attention. Et c'est cette attention, répétée séance après séance, qui transforme durablement l'épaule.",
      ],
      sabrina_quote: "L'épaule libre, c'est une épaule qui a appris à se poser avant de se lever.",
      key_movements: [
        { name: "Libérer les trapèzes", description: "Apprendre à relâcher consciemment les trapèzes, ces muscles que la sédentarité crispe sans qu'on s'en aperçoive. Le réveil des sensations passe par là.", duration: "5 min/jour", linked_session_id: "p1_5" },
        { name: "Mobiliser la scapula", description: "Glissement de l'omoplate sur la cage thoracique. Sans cette mobilité, le bras ne peut pas monter sans douleur. Premier réflexe à reconstruire.", duration: "8 min", linked_session_id: "p1_6" },
        { name: "Activer le dentelé antérieur", description: "Ce muscle oublié relie l'omoplate à la cage thoracique. Quand il dort, les épaules s'enroulent. Quand il s'éveille, la posture remonte.", duration: "10 min", linked_session_id: "p1_7" },
        { name: "Ouverture thoracique", description: "Étirement profond de la chaîne antérieure — pectoraux, poitrine, gorge. Indispensable après une journée d'écran.", duration: "8 min", linked_session_id: "p1_8" },
        { name: "Rotation externe guidée", description: "Activation de la coiffe des rotateurs. Pas spectaculaire, mais c'est la base. Un mouvement à intégrer dans la vie quotidienne.", duration: "6 min", linked_session_id: "p1_12" },
      ],
      recommended_programs: [
        { goal: "Libérer", duration_weeks: 2, frequency: 4, label: "Soulager les épaules tendues" },
        { goal: "Renforcer", duration_weeks: 4, frequency: 3, label: "Construire des épaules stables" },
        { goal: "Mobilité", duration_weeks: 6, frequency: 3, label: "Récupérer l'amplitude perdue" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p2 — Dos
    // ────────────────────────────────────────────────────────────────────
    p2: {
      hero_subtitle: "La rivière de ta vie quotidienne",
      anatomy: [
        "Le dos, c'est trente-trois vertèbres empilées qui forment une colonne souple et solide à la fois. Pas un mât rigide — une chaîne. Chaque maillon mobile, chaque segment irrigué de nerfs, chaque disque hydraté par le mouvement.",
        "Trois grandes zones rythment cette architecture : la lombaire (cinq vertèbres robustes qui portent le poids), la thoracique (douze vertèbres connectées aux côtes, plus stable mais souvent figée), la cervicale (sept vertèbres délicates qui soutiennent la tête — un poids de cinq kilos en équilibre).",
        "Autour de cette colonne, des muscles profonds — les multifides, les transverses, les érecteurs du rachis — travaillent en permanence pour maintenir l'alignement. Ils sont les véritables gardiens du dos. Plus profonds que les abdominaux qu'on voit dans le miroir, ce sont eux qui protègent vraiment les disques.",
        "Le dos ne souffre presque jamais d'un manque de force. Il souffre d'un manque de mouvement, et d'un excès de tension. Comprendre cela, c'est déjà commencer à guérir.",
      ],
      why_matters: [
        { icon: "office", text: "80 % des adultes connaîtront un mal de dos significatif au cours de leur vie. La sédentarité moderne est le premier facteur de risque." },
        { icon: "lift", text: "Porter ses courses, soulever un sac, prendre son enfant dans les bras — chaque geste du quotidien sollicite la chaîne postérieure. Un dos préparé, c'est une vie sans crainte." },
        { icon: "sleep", text: "Un dos tendu se réveille fatigué. Un dos libéré dort profondément. La qualité du sommeil dépend directement de la décompression vertébrale." },
        { icon: "sit", text: "Rester assis trop longtemps comprime les disques lombaires de 40 % par rapport à la position debout. Le mouvement régulier est la seule prévention durable." },
      ],
      pilates_approach: [
        "Le Pilates est né, en partie, pour le dos. Joseph Pilates avait constaté, dans les camps d'internement de la Première Guerre mondiale, que le mouvement contrôlé faisait des miracles sur les blessés alités. Il a fait du dos le centre de sa méthode.",
        "L'approche est singulière : on ne cherche pas à muscler le dos, on cherche à le décomprimer, à le mobiliser, à l'aligner. La force vient ensuite, presque comme un effet secondaire de l'alignement retrouvé.",
        "Tu vas découvrir des sensations nouvelles : la respiration latérale qui ouvre les côtes, le bassin qui bascule pour libérer la lombaire, les vertèbres qui se déroulent une à une comme une perle après l'autre. C'est lent, c'est précis, c'est transformateur.",
        "La règle d'or : avant de renforcer, on libère. Avant de gainer, on respire. Et toujours, on écoute. Le dos parle clairement à qui sait l'entendre — chaque tension est un message, chaque relâchement une réponse.",
      ],
      sabrina_quote: "Le dos ne guérit pas par le repos, mais par le mouvement juste.",
      key_movements: [
        { name: "Le dos expliqué", description: "Première vidéo pour comprendre l'architecture du dos avant de la travailler. À regarder absolument avant tout exercice.", duration: "2 min", linked_session_id: "p2_0" },
        { name: "Relâcher le psoas", description: "Ce muscle profond, le psoas, relie les lombaires aux cuisses. Quand il est tendu (et il l'est presque toujours chez les sédentaires), le bas du dos souffre.", duration: "20 min", linked_session_id: "p2_5" },
        { name: "Décompression lombaire", description: "Mouvements lents pour décharger les disques lombaires. Idéal après une longue journée assise.", duration: "22 min", linked_session_id: "p2_6" },
        { name: "Cat-Cow conscient", description: "Le mouvement fondamental du dos en Pilates et en yoga. Mobiliser chaque vertèbre, retrouver la fluidité de la colonne.", duration: "20 min", linked_session_id: "p2_8" },
        { name: "Pont fessier guidé", description: "Le pont actif les fessiers (souvent endormis) et soulage les lombaires (souvent surchargées). Un geste à pratiquer chaque jour.", duration: "28 min", linked_session_id: "p2_12" },
      ],
      recommended_programs: [
        { goal: "Soulager", duration_weeks: 3, frequency: 5, label: "Programme anti-douleur lombaire" },
        { goal: "Renforcer", duration_weeks: 6, frequency: 3, label: "Construire un dos solide et libre" },
        { goal: "Mobilité", duration_weeks: 4, frequency: 4, label: "Décompresser après le bureau" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p3 — Mobilité (hanches, genoux, chevilles)
    // ────────────────────────────────────────────────────────────────────
    p3: {
      hero_subtitle: "La liberté de t'ancrer et de te projeter",
      anatomy: [
        "La hanche est une articulation profonde — la tête du fémur s'emboîte dans le bassin comme une boule dans une coupe. Conçue pour la mobilité en six directions, elle perd cette amplitude par manque d'usage.",
        "Le genou, lui, est plus simple : essentiellement une charnière. Mais cette charnière dépend totalement de ce qu'il se passe au-dessus (hanche) et en dessous (cheville). Un genou qui souffre est presque toujours un genou pris en sandwich entre deux articulations défaillantes.",
        "La cheville, l'articulation la plus oubliée. Elle absorbe chaque pas, chaque saut, chaque changement de direction. Quand elle se raidit, c'est tout l'équilibre du corps qui se déstructure. La mobilité de la cheville prédit même le risque de chute après 60 ans.",
        "Hanches, genoux, chevilles forment une chaîne. Travailler isolément un maillon, c'est manquer le sujet. C'est l'intelligence du système qu'il faut restaurer.",
      ],
      why_matters: [
        { icon: "walk", text: "Marcher, monter les escaliers, se relever d'une chaise — autant de gestes invisibles tant qu'ils fonctionnent. Une mobilité préservée, c'est l'autonomie pour la vie." },
        { icon: "aging", text: "La perte de mobilité des hanches est l'un des premiers signes du vieillissement. La travailler, c'est ralentir l'horloge biologique." },
        { icon: "sit", text: "Rester assis raccourcit les fléchisseurs de hanche en quelques mois. Les libérer demande un travail régulier, mais les bénéfices se ressentent jusque dans le dos." },
        { icon: "sport", text: "Tous les sports debout — course, ski, golf, tennis — dépendent d'un bas du corps mobile et stable. La performance commence aux pieds." },
      ],
      pilates_approach: [
        "Le Pilates ne traite pas la hanche, le genou et la cheville comme des pièces séparées. Il les considère comme une chaîne articulaire, et c'est l'intelligence de la chaîne qu'il restaure.",
        "L'approche est progressive : on commence par sentir (où ça bloque, où ça circule), puis on mobilise (douces amplitudes), puis on renforce dans l'amplitude retrouvée. Jamais l'inverse — sinon on consolide les déséquilibres.",
        "Tu vas découvrir que la hanche s'ouvre par la respiration autant que par l'étirement. Que le genou se stabilise par la cheville. Que la mobilité ne s'arrache pas — elle s'invite. C'est une question de patience et de précision.",
        "Le travail proprioceptif est central : sentir le poids dans le pied, sentir le bassin libre, sentir le genou aligné. Ces sensations, perdues par la sédentarité, sont les fondations sur lesquelles tout le reste se construit.",
      ],
      sabrina_quote: "Mobiliser, c'est rajeunir. Chaque degré de liberté retrouvé est une victoire sur le temps.",
      key_movements: [
        { name: "Comprendre la hanche", description: "Vidéo introductive pour saisir l'anatomie fonctionnelle de la hanche avant de la travailler.", duration: "2 min", linked_session_id: "p3_0" },
        { name: "Mobilisation de hanche I", description: "Cercles, ouvertures, fermetures — toute l'amplitude de la hanche dans une seule séance fondatrice.", duration: "20 min", linked_session_id: "p3_5" },
        { name: "Libération des fléchisseurs", description: "Les psoas et iliaques, raccourcis par la station assise, s'allongent ici dans la conscience du mouvement.", duration: "22 min", linked_session_id: "p3_6" },
        { name: "Mobilité du genou", description: "Travail spécifique sur la stabilité de la rotule et l'alignement fémur-tibia. Crucial pour qui marche, court ou pratique un sport.", duration: "20 min", linked_session_id: "p3_8" },
        { name: "La cheville en action", description: "Mobilisation et renforcement des chevilles — la fondation invisible de tout l'équilibre du corps.", duration: "22 min", linked_session_id: "p3_9" },
      ],
      recommended_programs: [
        { goal: "Mobilité", duration_weeks: 4, frequency: 4, label: "Hanches & bassin libérés" },
        { goal: "Stabilité", duration_weeks: 6, frequency: 3, label: "Renforcer genoux et chevilles" },
        { goal: "Posture", duration_weeks: 8, frequency: 3, label: "Bas du corps intégré" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p4 — Posture
    // ────────────────────────────────────────────────────────────────────
    p4: {
      hero_subtitle: "L'architecture invisible de ton corps",
      anatomy: [
        "La posture, ce n'est pas se tenir droit — c'est se tenir aligné. La colonne vertébrale dessine quatre courbes naturelles (lordose cervicale, cyphose dorsale, lordose lombaire, sacrum) qui amortissent les chocs et répartissent les charges. Quand ces courbes s'exagèrent ou s'aplanissent, le système entier souffre.",
        "Le bassin est la clé de voûte. Sa bascule (antérieure ou postérieure) gouverne tout ce qui se passe au-dessus et en-dessous. Une bascule trop antérieure cambre la lombaire ; trop postérieure efface la lordose et tasse le bas du dos.",
        "La tête pèse environ cinq kilos en position neutre. Inclinée de 30 degrés vers l'avant (la posture typique du téléphone), elle pèse 18 kilos sur les cervicales. C'est l'équivalent d'un enfant accroché à ton cou, toute la journée.",
        "La bonne posture n'est jamais figée — c'est une danse permanente de micro-ajustements. Le corps oscille sans cesse autour d'un axe central. La conscience de cet axe est ce qu'on cherche à cultiver.",
      ],
      why_matters: [
        { icon: "screen", text: "Le 'tech neck' — cou tendu vers l'écran — est devenu épidémique. Migraines, douleurs cervicales, fatigue oculaire en sont les conséquences directes." },
        { icon: "office", text: "Une mauvaise posture assise tasse les organes digestifs, restreint la respiration, ralentit la circulation. Le bien-être global passe par l'alignement." },
        { icon: "sport", text: "En sport, la posture est synonyme d'efficacité. Le même geste exécuté aligné consomme moins d'énergie et préserve les articulations." },
        { icon: "aging", text: "La posture trahit l'âge bien plus que les rides. Une silhouette droite et libre rajeunit visuellement de dix ans — sans aucune intervention." },
      ],
      pilates_approach: [
        "Le Pilates ne demande pas de 'se tenir droit'. Il enseigne où sont les points d'appui, comment circule le poids, ce que veut dire 'l'axe central'. La posture émerge alors d'elle-même, sans effort de tenue.",
        "L'approche se construit en trois étapes : prendre conscience (où je suis vraiment, indépendamment de l'image dans le miroir), libérer (les blocages qui empêchent l'alignement), activer (les stabilisateurs profonds qui maintiennent l'alignement sans tension).",
        "Tu vas sentir, après quelques séances, une chose très étrange : tu te tiens droit sans y penser. Ce n'est plus un effort volontaire — c'est devenu une organisation naturelle du corps. C'est ce qu'on appelle l'intégration posturale.",
        "Le travail postural est probablement le bénéfice le plus durable du Pilates. Les exercices passent — la posture, elle, reste. C'est un investissement à long terme dans la qualité de vie.",
      ],
      sabrina_quote: "Se tenir droit ne signifie pas se raidir. Ça signifie s'aligner — et laisser le squelette faire son travail.",
      key_movements: [
        { name: "La posture expliquée", description: "Comprendre les 4 courbes naturelles de la colonne et l'axe central. Fondation théorique avant la pratique.", duration: "12 min", linked_session_id: "p4_0" },
        { name: "Ressentir l'alignement", description: "Exercice de proprioception : sentir où le corps est, indépendamment de ce qu'on voit. Le miroir ment, le ressenti pas.", duration: "12 min", linked_session_id: "p4_3" },
        { name: "Rééquilibrer le bassin", description: "Travail spécifique sur la bascule du bassin — la clé de voûte de toute la posture.", duration: "25 min", linked_session_id: "p4_7" },
        { name: "Aligner le cou", description: "Replacer la tête sur la colonne. Geste salutaire après des années de téléphone et d'écran.", duration: "22 min", linked_session_id: "p4_8" },
        { name: "Debout conscient", description: "Apprendre à se tenir debout — vraiment. Sans tension, sans effort, dans l'axe.", duration: "25 min", linked_session_id: "p4_10" },
      ],
      recommended_programs: [
        { goal: "Alignement", duration_weeks: 4, frequency: 4, label: "Reconstruire ta posture" },
        { goal: "Bureau", duration_weeks: 3, frequency: 5, label: "Anti tech-neck" },
        { goal: "Intégration", duration_weeks: 8, frequency: 3, label: "Posture pour la vie" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p5 — Respiration (le pilier Eldoa nominal, mais le contenu est sur le souffle)
    // ────────────────────────────────────────────────────────────────────
    p5: {
      hero_subtitle: "Le rythme silencieux qui te traverse",
      anatomy: [
        "Tu respires environ 20 000 fois par jour. Et pourtant, sauf si tu pratiques, tu n'as quasiment aucune conscience de ce mouvement. Le souffle est le seul système autonome que tu peux aussi contrôler volontairement — c'est ton pont entre le corps et l'esprit.",
        "Le diaphragme est ton muscle respiratoire principal. Une coupole musculaire qui descend à l'inspiration (faisant gonfler le ventre) et remonte à l'expiration. Quand il est libre, il bouge de 7 à 10 cm à chaque cycle. Quand il est tendu, à peine 2 ou 3.",
        "Le souffle est tridimensionnel : il s'expanse vers l'avant (le ventre), mais aussi sur les côtés (les côtes flottantes) et vers l'arrière (le dos respire aussi). La plupart d'entre nous n'utilisent qu'une fraction de leur capacité respiratoire.",
        "Le système nerveux suit le souffle. Un souffle court, haut dans la poitrine, active le stress. Un souffle long, lent, profond, active le calme. C'est une bascule physiologique que tu peux apprendre à manœuvrer à volonté.",
      ],
      why_matters: [
        { icon: "tension", text: "70 % du stress chronique est respiratoire. Apprendre à respirer profondément est probablement le moyen le plus accessible de calmer le système nerveux." },
        { icon: "sleep", text: "Un souffle apaisé prépare le sommeil. Cinq minutes de respiration consciente le soir transforment la qualité de la nuit." },
        { icon: "energy", text: "L'oxygénation est le carburant cellulaire. Mieux respirer, c'est avoir plus d'énergie, sans café, sans effort supplémentaire." },
        { icon: "sport", text: "En activité physique, la respiration coordonnée optimise l'effort. C'est elle qui sépare les athlètes accomplis des autres." },
      ],
      pilates_approach: [
        "Le Pilates a une signature respiratoire unique : la respiration latérale. Inspirer en gonflant les côtés et le dos (et non le ventre), expirer en engageant le plancher pelvien et le transverse. C'est cette technique qui permet de gainer tout en respirant — chose impossible avec la respiration ventrale classique.",
        "Joseph Pilates disait : « Avant tout, apprenez à respirer correctement. » Toute sa méthode repose sur cette base. Chaque mouvement est synchronisé avec un cycle respiratoire — l'effort sur l'expiration, l'ouverture sur l'inspiration.",
        "Tu vas découvrir des sensations très nouvelles : les côtes qui s'ouvrent latéralement, le dos qui respire, le périnée qui s'active en fin d'expiration. Au bout de quelques semaines, ta respiration au repos changera spontanément — plus profonde, plus lente, plus efficace.",
        "Le souffle est l'outil le plus puissant que tu possèdes pour transformer ton état intérieur. Le Pilates t'apprend à le maîtriser non pas comme une discipline, mais comme un art de vivre.",
      ],
      sabrina_quote: "Respire. Le reste suivra. La respiration est le chef d'orchestre de tout mouvement.",
      key_movements: [
        { name: "Comprendre le souffle", description: "Vidéo introductive : qu'est-ce que respirer, vraiment ? Le minimum à savoir avant tout travail respiratoire.", duration: "12 min", linked_session_id: "p5_0" },
        { name: "Le souffle tridimensionnel", description: "Découvrir que le souffle s'expanse dans trois directions, pas seulement le ventre. Sensation fondatrice.", duration: "15 min", linked_session_id: "p5_4" },
        { name: "Cohérence cardiaque I", description: "Pratique simple et puissante : 5 secondes d'inspiration, 5 secondes d'expiration. Équilibrage du système nerveux.", duration: "12 min", linked_session_id: "p5_5" },
        { name: "Respiration latérale", description: "La signature respiratoire du Pilates. Indispensable pour combiner gainage et respiration.", duration: "18 min", linked_session_id: "p5_7" },
        { name: "Pilates breathing I", description: "Intégration du souffle Pilates au mouvement. Le pont entre la théorie et la pratique.", duration: "20 min", linked_session_id: "p5_10" },
      ],
      recommended_programs: [
        { goal: "Calmer", duration_weeks: 2, frequency: 7, label: "5 minutes anti-stress quotidiennes" },
        { goal: "Souffle", duration_weeks: 4, frequency: 4, label: "Maîtriser la respiration consciente" },
        { goal: "Intégration", duration_weeks: 6, frequency: 3, label: "Souffle et mouvement unis" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p6 — Pleine conscience du mouvement / Proprioception
    // ────────────────────────────────────────────────────────────────────
    p6: {
      hero_subtitle: "Le sixième sens qui change tout",
      anatomy: [
        "Tu connais cinq sens. Tu en possèdes en réalité un sixième, le plus précieux : la proprioception. C'est la capacité de ton corps à se situer dans l'espace sans le voir. Ferme les yeux, lève un bras — tu sais où il est. C'est ça, la proprioception.",
        "Des millions de récepteurs, disséminés dans les muscles, les tendons, les articulations et la peau, envoient en permanence des signaux au cerveau. Ce flot d'informations cartographie ton corps en temps réel. Quand cette carte est nette, tu te meus avec aisance. Quand elle s'estompe, tu trébuches, tu bloques, tu blesses.",
        "La proprioception se dégrade avec la sédentarité. Elle s'aiguise avec le mouvement conscient. C'est pour ça que les pratiquants de Pilates, danseurs, gymnastes ont une coordination remarquable jusqu'à un âge avancé — leur carte interne reste précise.",
        "Cette intelligence corporelle est aussi liée à la prévention des chutes après 60 ans, à la guérison post-blessure, à la maîtrise gestuelle. C'est probablement le sens le plus négligé — et le plus crucial.",
      ],
      why_matters: [
        { icon: "aging", text: "Les chutes sont la première cause d'hospitalisation après 65 ans. Une proprioception entretenue est la meilleure prévention." },
        { icon: "sport", text: "En sport, c'est elle qui fait la différence entre un geste juste et un geste blessant. Les athlètes de haut niveau l'entraînent spécifiquement." },
        { icon: "tension", text: "Beaucoup de tensions chroniques viennent d'une mauvaise lecture du corps. Quand la proprioception se restaure, certaines douleurs s'effacent." },
        { icon: "office", text: "Au bureau, sans repères corporels, on s'avachit sans s'en rendre compte. La proprioception aide à corriger en temps réel." },
      ],
      pilates_approach: [
        "Le Pilates est, peut-être avant toute chose, un entraînement proprioceptif. Chaque exercice demande de sentir précisément où le corps est, ce qu'il fait, comment il bouge. C'est cette attention soutenue qui développe l'intelligence corporelle.",
        "On travaille les yeux fermés, on travaille lentement, on travaille avec attention aux détails. Pas par lenteur — par densité. Une minute de mouvement conscient vaut dix minutes de mouvement automatique.",
        "Tu vas découvrir, séance après séance, que ton corps a un langage. Qu'il te parle constamment, mais que tu n'écoutais pas. Que tes deux côtés ne sont pas symétriques, que tes pieds se posent différemment, que ta respiration n'est pas la même selon les heures.",
        "Cette conscience, une fois éveillée, ne s'éteint plus. Elle te suit dans la marche, dans le sport, dans le sommeil. C'est probablement le cadeau le plus précieux que le Pilates fait à ses pratiquants — la rencontre avec son propre corps.",
      ],
      sabrina_quote: "Le corps sait. Il faut juste apprendre à l'écouter. La conscience corporelle se cultive, jour après jour.",
      key_movements: [
        { name: "Qu'est-ce que la proprioception", description: "Comprendre ce sixième sens avant de l'éveiller. Théorie indispensable pour la suite.", duration: "12 min", linked_session_id: "p6_0" },
        { name: "Le scan corporel I", description: "Première pratique d'écoute du corps. Tête aux pieds, sentir sans chercher à changer.", duration: "12 min", linked_session_id: "p6_3" },
        { name: "Sentir sans voir", description: "Travail les yeux fermés. La proprioception se développe quand on retire la vue.", duration: "15 min", linked_session_id: "p6_4" },
        { name: "Équilibre statique I", description: "Stabilisation sur un pied — l'exercice proprioceptif fondamental. Simple en apparence, riche en sensations.", duration: "15 min", linked_session_id: "p6_5" },
        { name: "Mouvement lent I", description: "Réaliser un geste connu à 10 % de sa vitesse habituelle. Tu y découvriras tout ce que tu ne percevais pas.", duration: "20 min", linked_session_id: "p6_10" },
      ],
      recommended_programs: [
        { goal: "Éveil", duration_weeks: 3, frequency: 4, label: "Cultiver ton sixième sens" },
        { goal: "Équilibre", duration_weeks: 6, frequency: 3, label: "Stabilité et coordination" },
        { goal: "Méditation", duration_weeks: 8, frequency: 4, label: "Mouvement et présence" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p7 — Mat Pilates
    // ────────────────────────────────────────────────────────────────────
    p7: {
      hero_subtitle: "L'œuvre originale de Joseph Pilates",
      anatomy: [
        "Le Mat Pilates, c'est le Pilates dans sa forme la plus pure : au sol, sans machine, avec son propre corps comme seule résistance. Joseph Pilates a conçu cette série de mouvements dans les années 1920, pendant la Première Guerre mondiale. Près d'un siècle plus tard, sa pertinence n'a pas pris une ride.",
        "Le Mat repose sur six principes intangibles : concentration, contrôle, centre, fluidité, précision, respiration. Tous travaillent ensemble. Aucun mouvement n'est exécuté sans qu'au moins quatre de ces principes ne soient présents.",
        "Le « powerhouse » — la centrale énergétique — est la zone qui s'étend du bas des côtes au plancher pelvien. C'est l'origine de tout mouvement en Pilates. Quand le centre est engagé, les bras et les jambes peuvent bouger librement, comme les branches d'un arbre solidement planté.",
        "Le Mat se pratique pieds nus, en silence (ou avec une musique discrète), avec une concentration soutenue. Ce n'est pas un cours de fitness — c'est une pratique. Plus proche du yoga ou des arts martiaux internes que du sport classique.",
      ],
      why_matters: [
        { icon: "home", text: "Le Mat se pratique partout. Un tapis et un mètre carré suffisent. Pas d'excuse, pas d'équipement à acheter, pas de salle à fréquenter." },
        { icon: "energy", text: "Une séance de 25 minutes équilibrée mobilise tout le corps. C'est l'un des entraînements les plus complets que tu puisses pratiquer." },
        { icon: "aging", text: "Joseph Pilates pratiquait jusqu'à 87 ans. Le Mat est une méthode pour la vie entière — adaptable à tout âge, à toute condition physique." },
        { icon: "tension", text: "Au-delà du physique, le Mat apaise. La concentration requise éteint le bruit mental. Beaucoup le décrivent comme une méditation active." },
      ],
      pilates_approach: [
        "L'approche du Mat est singulière par sa progression : on commence par le centre, puis on intègre les extrémités. Avant le Hundred (le mouvement emblématique), il y a six préparations. Avant la série des 5, il y a des semaines d'activation du transverse.",
        "Chaque exercice a un nom, une intention précise, une exécution codifiée. Ce n'est pas du fitness libre — c'est un répertoire transmis depuis presque cent ans, affiné par des milliers de praticiens. Cette discipline est ce qui rend la méthode efficace.",
        "Tu vas sentir, très vite, deux choses : d'abord que c'est plus difficile que tu ne le pensais (les mouvements lents demandent une force réelle), ensuite que c'est plus subtil que tu ne le pensais (la sensation prime sur la performance).",
        "Pratique le Mat trois fois par semaine pendant trois mois — tu seras un autre. C'est la promesse réaliste de la méthode. Pas une transformation spectaculaire, mais un changement profond de la qualité corporelle.",
      ],
      sabrina_quote: "Le Pilates n'est pas un exercice. C'est un art de vivre.",
      key_movements: [
        { name: "Joseph Pilates & sa méthode", description: "Histoire fondatrice. Comprendre d'où vient la méthode avant de la pratiquer.", duration: "12 min", linked_session_id: "p7_0" },
        { name: "Les 6 principes du Mat", description: "Concentration, contrôle, centre, fluidité, précision, respiration. Les six fondations à intégrer.", duration: "15 min", linked_session_id: "p7_1" },
        { name: "Le centre — powerhouse", description: "Localiser et activer la centrale énergétique. La porte d'entrée vers toute la pratique.", duration: "15 min", linked_session_id: "p7_2" },
        { name: "Le Hundred — initiation", description: "L'exercice emblématique de Joseph Pilates. À aborder progressivement, mais incontournable.", duration: "20 min", linked_session_id: "p7_5" },
        { name: "La série des 5", description: "Cinq exercices enchaînés qui réveillent tout le centre. Le cœur de la pratique débutante.", duration: "25 min", linked_session_id: "p7_10" },
      ],
      recommended_programs: [
        { goal: "Débuter", duration_weeks: 4, frequency: 3, label: "Découverte du Mat" },
        { goal: "Approfondir", duration_weeks: 8, frequency: 3, label: "Mat niveau intermédiaire" },
        { goal: "Maîtriser", duration_weeks: 12, frequency: 4, label: "Mat avancé et flow complet" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p8 — Office / Bureau
    // ────────────────────────────────────────────────────────────────────
    p8: {
      hero_subtitle: "Reprendre ton corps entre deux réunions",
      anatomy: [
        "Le corps humain n'est pas conçu pour rester assis huit heures par jour. C'est une donnée biologique. Sur les 200 000 ans d'évolution d'Homo sapiens, la chaise de bureau a, à l'échelle, trente secondes d'histoire. Notre anatomie en paie le prix.",
        "En position assise prolongée, plusieurs choses se passent : les fléchisseurs de hanche se raccourcissent, les fessiers se désactivent, les abdominaux se relâchent, la lombaire se tasse, la nuque s'avance, les trapèzes se contractent. Un véritable processus d'effondrement, lent et silencieux.",
        "Les yeux fixés sur un écran réduisent la fréquence de clignement de 60 %. La nuque inclinée multiplie par 4 la charge sur les cervicales. Les poignets en hyperextension perpétuelle ouvrent la voie au syndrome du canal carpien. C'est un environnement hostile au corps.",
        "La bonne nouvelle : 5 à 10 minutes de mouvement ciblé toutes les 90 minutes suffisent à neutraliser la plupart de ces effets. Le corps est résilient — il demande juste qu'on l'écoute un peu.",
      ],
      why_matters: [
        { icon: "screen", text: "Le mal de dos est la première cause d'arrêt de travail dans les métiers de bureau. Prévenir vaut mille fois mieux que guérir." },
        { icon: "office", text: "Une pause active de 5 minutes améliore la concentration des 25 minutes suivantes. C'est un investissement, pas une perte de temps." },
        { icon: "tension", text: "Les douleurs cervicales du bureau remontent en migraines. Mobiliser la nuque, c'est souvent guérir la tête." },
        { icon: "energy", text: "La sédentarité fatigue plus qu'elle ne repose. Bouger un peu redonne plus d'énergie qu'une pause café." },
      ],
      pilates_approach: [
        "Le Pilates Office adapte les principes fondamentaux à la contrainte du bureau : peu de temps, peu d'espace, vêtements de travail, parfois les yeux des collègues. Les mouvements sont courts (3 à 10 minutes), réalisables sur ou à côté de la chaise, discrets si nécessaire.",
        "L'approche cible précisément les zones que le bureau abîme : nuque, épaules, lombaire, hanches, poignets. Pas de longue séance — des micro-pratiques régulières, plus efficaces qu'un cours intensif le week-end.",
        "Tu vas découvrir qu'il est possible de transformer la station assise en mouvement subtil : bascule du bassin, rotation thoracique, étirement des chaînes, respiration consciente. La chaise devient un outil, pas une prison.",
        "Le plus important : la régularité. Trois micro-pauses dans la journée — matin, midi, après-midi — valent infiniment mieux qu'une séance hebdomadaire de Pilates classique. La constance bat l'intensité.",
      ],
      sabrina_quote: "Le vrai ennemi du dos, c'est la sédentarité. Bouger un peu, souvent, c'est l'antidote.",
      key_movements: [
        { name: "Pourquoi le bureau fatigue", description: "Comprendre les mécanismes par lesquels la station assise abîme le corps. Préalable à toute action.", duration: "5 min", linked_session_id: "p8_0" },
        { name: "Étirements nuque assis", description: "Cinq minutes pour libérer la nuque sans quitter sa chaise. À répéter trois fois par jour.", duration: "5 min", linked_session_id: "p8_5" },
        { name: "Épaules au bureau — relâcher", description: "Mobilisation discrète des épaules. Idéal entre deux visioconférences.", duration: "7 min", linked_session_id: "p8_7" },
        { name: "Micro-pause active — 3 min", description: "Trois minutes chrono, debout à côté de la chaise. Reset complet du corps et de l'attention.", duration: "3 min", linked_session_id: "p8_12" },
        { name: "Routine matin au bureau", description: "Démarrer la journée par 8 minutes de préparation corporelle. Change radicalement la posture du jour.", duration: "8 min", linked_session_id: "p8_18" },
      ],
      recommended_programs: [
        { goal: "Prévention", duration_weeks: 4, frequency: 5, label: "Anti tech-neck quotidien" },
        { goal: "Énergie", duration_weeks: 3, frequency: 5, label: "Pauses actives transformatrices" },
        { goal: "Posture", duration_weeks: 6, frequency: 5, label: "Reconstruire sa posture au travail" },
      ],
    },

    // ────────────────────────────────────────────────────────────────────
    // p9 — Ménopause
    // ────────────────────────────────────────────────────────────────────
    p9: {
      hero_subtitle: "Traverser ce passage avec conscience",
      anatomy: [
        "La ménopause n'est pas une maladie. C'est un passage biologique majeur — l'arrêt progressif de la production d'œstrogènes et de progestérone. Pour le corps, c'est un séisme silencieux : densité osseuse qui s'effrite, masse musculaire qui décline, métabolisme qui ralentit, peau qui change.",
        "L'œstrogène protégeait l'os, le muscle, le cœur, le cerveau. Sa diminution accélère le vieillissement de plusieurs systèmes en même temps. L'ostéoporose menace, la sarcopénie (perte de muscle) s'accélère, le plancher pelvien s'affaiblit.",
        "Le plancher pelvien, justement, mérite une attention particulière. Composé de muscles profonds qui soutiennent la vessie, l'utérus et les intestins, il s'affaiblit avec la baisse hormonale. Sa rééducation est l'une des actions les plus utiles de cette période.",
        "Mais ce passage n'est pas que perte. C'est aussi un moment de libération, de redéfinition, de réappropriation du corps. Bien accompagné, c'est une nouvelle puissance qui s'installe — différente de l'ancienne, mais réelle.",
      ],
      why_matters: [
        { icon: "aging", text: "La densité osseuse diminue de 2 à 5 % par an en début de ménopause. Le Pilates en charge ralentit drastiquement cette perte." },
        { icon: "sleep", text: "Les bouffées de chaleur perturbent le sommeil. Les techniques respiratoires apaisent à la fois le système nerveux et la régulation thermique." },
        { icon: "energy", text: "La perte musculaire (sarcopénie) accélère après 50 ans. Le travail régulier, même modéré, la freine — voire l'inverse." },
        { icon: "tension", text: "Le stress amplifie tous les symptômes. Travailler le souffle et la pleine conscience corporelle change le vécu de cette période." },
      ],
      pilates_approach: [
        "Le Pilates est particulièrement adapté à la ménopause : il travaille en charge (bénéfique pour l'os), il préserve la masse musculaire (essentielle), il intègre la respiration (régulation hormonale et émotionnelle), il rééduque le plancher pelvien (souvent négligé).",
        "L'approche est progressive et respectueuse. Pas de programme générique — chaque corps traverse la ménopause différemment. Le travail s'adapte : plus doux les jours de fatigue, plus tonique les jours de forme. La régularité prime sur l'intensité.",
        "Tu vas découvrir qu'au lieu de subir cette période, tu peux la traverser activement. Le mouvement conscient devient un allié — il agit sur le sommeil, sur l'humeur, sur la confiance en soi, sur le rapport au corps qui change.",
        "Le bénéfice se construit sur le long terme. Ce n'est pas l'effet d'une séance, mais d'une pratique. Trois mois de Pilates régulier transforment plus le quotidien que n'importe quel traitement isolé. C'est un investissement dans les vingt prochaines années.",
      ],
      sabrina_quote: "La ménopause n'est pas une fin — c'est une étape. Avec le mouvement juste, elle peut devenir une renaissance.",
      key_movements: [
        { name: "La ménopause expliquée", description: "Comprendre ce qui se passe dans le corps. Le premier pas pour ne plus subir.", duration: "6 min", linked_session_id: "p9_0" },
        { name: "Ton plancher pelvien, en conscience", description: "Localiser, sentir, activer le plancher pelvien. Travail fondateur de toute la suite.", duration: "9 min", linked_session_id: "p9_3" },
        { name: "Respirer pour calmer les bouffées", description: "Techniques respiratoires spécifiques pour apaiser les bouffées de chaleur. À pratiquer dès les premiers signes.", duration: "8 min", linked_session_id: "p9_4" },
        { name: "Os solides", description: "Travail en charge pour préserver la densité osseuse. La meilleure prévention contre l'ostéoporose.", duration: "20 min", linked_session_id: "p9_7" },
        { name: "Sommeil réparateur", description: "Séquence du soir pour préparer le corps au sommeil. Particulièrement précieuse en ménopause.", duration: "17 min", linked_session_id: "p9_9" },
      ],
      recommended_programs: [
        { goal: "Adapter", duration_weeks: 4, frequency: 3, label: "Accompagner les premiers symptômes" },
        { goal: "Os & muscle", duration_weeks: 8, frequency: 4, label: "Préserver le capital corporel" },
        { goal: "Vitalité", duration_weeks: 12, frequency: 3, label: "Retrouver énergie et confiance" },
      ],
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // English translation
  // ════════════════════════════════════════════════════════════════════════
  en: {
    p1: {
      hero_subtitle: "The doorway to your world",
      anatomy: [
        "The shoulder isn't just a joint — it's an orchestra. Three bones (the scapula, the clavicle, the humerus) dance together, supported by about twenty muscles. It's the most mobile joint in the body, and also the most vulnerable.",
        "At the heart of this balance, the rotator cuff — four small deep muscles — stabilizes the head of the humerus inside a cavity barely larger than a coin. When these stabilizers fall asleep, the trapezius and neck muscles take over. And eventually, they scream.",
        "The shoulder blade itself should glide freely on the rib cage. But hours spent in front of a screen, shoulders rolled forward, turn that fluid glide into chronic friction. The result: tension, pain, stiffness that climbs all the way up the neck.",
        "Understanding the shoulder means understanding that the freedom of the arm starts in the back. Before lifting, you must stabilize. Before pushing, you must anchor.",
      ],
      why_matters: [
        { icon: "lift", text: "Carrying groceries, lifting a child, reaching for something high — it all goes through the shoulder. A free shoulder means a daily life without pain." },
        { icon: "office", text: "Eight hours a day in front of a screen rolls shoulders forward. Without regular re-awakening of the stabilizers, the body forgets how to stand tall." },
        { icon: "sleep", text: "Sleeping on your side with a tense shoulder means waking up with stiffness that pollutes the entire day." },
        { icon: "sport", text: "From tennis to yoga, from golf to swimming, every precise movement depends on an aligned shoulder. It's the foundation of every noble gesture." },
      ],
      pilates_approach: [
        "Pilates approaches the shoulder by indirection. Instead of strengthening it head-on like classic muscle training, it begins by freeing it. You learn to release the trapezius, to let the shoulder blade settle, to feel the weight of the arm before mobilizing it.",
        "Joseph Pilates understood this: ‟Before moving, you must place.\" Strength is born from that precision. A shoulder trained in Pilates isn't a bigger shoulder — it's a more accurate one.",
        "You'll feel something strange after the first sessions: less tension in the neck. That's the sign your stabilizers are waking up. Movement becomes freer, quieter. The shoulder finds its natural place.",
        "Pilates doesn't demand effort — it demands attention. And it's that attention, repeated session after session, that durably transforms the shoulder.",
      ],
      sabrina_quote: "A free shoulder is one that learned to settle before lifting.",
      key_movements: [
        { name: "Releasing the trapezius", description: "Learning to consciously release the trapezius — muscles a sedentary life stiffens without us noticing. Sensation awakening starts here.", duration: "5 min/day", linked_session_id: "p1_5" },
        { name: "Mobilizing the scapula", description: "Glide of the shoulder blade on the rib cage. Without this mobility, the arm can't rise without pain. First reflex to rebuild.", duration: "8 min", linked_session_id: "p1_6" },
        { name: "Activating the serratus", description: "This forgotten muscle connects the shoulder blade to the rib cage. When it sleeps, shoulders curl in. When it awakens, posture climbs.", duration: "10 min", linked_session_id: "p1_7" },
        { name: "Thoracic opening", description: "Deep stretch of the front chain — pecs, chest, throat. Essential after a day on screen.", duration: "8 min", linked_session_id: "p1_8" },
        { name: "Guided external rotation", description: "Rotator cuff activation. Not spectacular, but foundational. A movement to bring into everyday life.", duration: "6 min", linked_session_id: "p1_12" },
      ],
      recommended_programs: [
        { goal: "Release", duration_weeks: 2, frequency: 4, label: "Soothe tense shoulders" },
        { goal: "Strengthen", duration_weeks: 4, frequency: 3, label: "Build stable shoulders" },
        { goal: "Mobility", duration_weeks: 6, frequency: 3, label: "Recover lost range" },
      ],
    },

    p2: {
      hero_subtitle: "The river of your daily life",
      anatomy: [
        "The back is thirty-three vertebrae stacked into a column that's both supple and solid. Not a rigid mast — a chain. Each link mobile, each segment irrigated with nerves, each disc hydrated by movement.",
        "Three major zones rhythm this architecture: the lumbar (five robust vertebrae carrying the weight), the thoracic (twelve vertebrae connected to ribs, more stable but often locked), the cervical (seven delicate vertebrae supporting the head — a five-kilo weight balanced on top).",
        "Around this column, deep muscles — multifidus, transversus, erector spinae — work continuously to maintain alignment. They are the true guardians of the back. Deeper than the abs you see in the mirror, they are the ones that truly protect the discs.",
        "The back almost never suffers from a lack of strength. It suffers from a lack of movement and an excess of tension. Understanding this is already the beginning of healing.",
      ],
      why_matters: [
        { icon: "office", text: "80% of adults will experience significant back pain in their lifetime. Modern sedentary life is the primary risk factor." },
        { icon: "lift", text: "Carrying groceries, lifting a bag, holding a child — every daily gesture engages the posterior chain. A prepared back means a fearless life." },
        { icon: "sleep", text: "A tense back wakes up tired. A released back sleeps deeply. Sleep quality directly depends on spinal decompression." },
        { icon: "sit", text: "Staying seated too long compresses the lumbar discs by 40% compared to standing. Regular movement is the only durable prevention." },
      ],
      pilates_approach: [
        "Pilates was born, in part, for the back. Joseph Pilates noticed, in WWI internment camps, that controlled movement worked miracles on bed-ridden patients. He made the back the center of his method.",
        "The approach is unique: we don't try to muscle the back, we try to decompress it, mobilize it, align it. Strength comes after, almost as a side-effect of restored alignment.",
        "You'll discover new sensations: lateral breathing that opens the ribs, the pelvis tilting to free the lumbar, the vertebrae unrolling one by one like beads on a string. It's slow, precise, transformative.",
        "The golden rule: before strengthening, release. Before bracing, breathe. And always, listen. The back speaks clearly to whoever knows how to hear it — every tension is a message, every release an answer.",
      ],
      sabrina_quote: "The back doesn't heal through rest, but through the right movement.",
      key_movements: [
        { name: "The back explained", description: "First video to understand the architecture of the back before working it. Watch this before any exercise.", duration: "2 min", linked_session_id: "p2_0" },
        { name: "Releasing the psoas", description: "This deep muscle, the psoas, connects the lumbar to the thighs. When tense (and it almost always is for sedentary people), the low back suffers.", duration: "20 min", linked_session_id: "p2_5" },
        { name: "Lumbar decompression", description: "Slow movements to unload the lumbar discs. Ideal after a long sitting day.", duration: "22 min", linked_session_id: "p2_6" },
        { name: "Conscious Cat-Cow", description: "The fundamental back movement in Pilates and yoga. Mobilize every vertebra, recover the fluidity of the column.", duration: "20 min", linked_session_id: "p2_8" },
        { name: "Guided glute bridge", description: "The bridge activates the glutes (often asleep) and relieves the lumbar (often overloaded). A daily-practice gesture.", duration: "28 min", linked_session_id: "p2_12" },
      ],
      recommended_programs: [
        { goal: "Relieve", duration_weeks: 3, frequency: 5, label: "Anti-pain lumbar program" },
        { goal: "Strengthen", duration_weeks: 6, frequency: 3, label: "Build a strong and free back" },
        { goal: "Mobility", duration_weeks: 4, frequency: 4, label: "Decompress after the office" },
      ],
    },

    p3: {
      hero_subtitle: "The freedom to anchor and propel",
      anatomy: [
        "The hip is a deep joint — the head of the femur fits into the pelvis like a ball into a cup. Designed for mobility in six directions, it loses that range from disuse.",
        "The knee is simpler: essentially a hinge. But that hinge depends entirely on what happens above (hip) and below (ankle). A painful knee is almost always a knee caught between two failing joints.",
        "The ankle is the most overlooked joint. It absorbs every step, every jump, every change of direction. When it stiffens, the entire body's balance falls apart. Ankle mobility even predicts fall risk after age 60.",
        "Hips, knees, ankles form a chain. Working a single link in isolation misses the point. It's the intelligence of the system that must be restored.",
      ],
      why_matters: [
        { icon: "walk", text: "Walking, climbing stairs, getting up from a chair — invisible gestures as long as they work. Preserved mobility means autonomy for life." },
        { icon: "aging", text: "Loss of hip mobility is one of the first signs of aging. Working it slows the biological clock." },
        { icon: "sit", text: "Sitting shortens hip flexors within months. Releasing them takes regular work, but benefits ripple all the way up to the back." },
        { icon: "sport", text: "All standing sports — running, skiing, golf, tennis — depend on a mobile, stable lower body. Performance starts at the feet." },
      ],
      pilates_approach: [
        "Pilates doesn't treat hip, knee, and ankle as separate pieces. It considers them as an articular chain, and it restores the intelligence of the chain.",
        "The approach is progressive: first feel (where it blocks, where it flows), then mobilize (gentle range), then strengthen within the recovered range. Never the reverse — otherwise we consolidate imbalances.",
        "You'll discover that the hip opens through breath as much as through stretching. That the knee stabilizes via the ankle. That mobility isn't ripped — it's invited. It's a matter of patience and precision.",
        "Proprioceptive work is central: feeling the weight in the foot, feeling the pelvis free, feeling the knee aligned. These sensations, lost to sedentary life, are the foundations on which everything else builds.",
      ],
      sabrina_quote: "To mobilize is to rejuvenate. Every degree of freedom regained is a victory over time.",
      key_movements: [
        { name: "Understanding the hip", description: "Introductory video to grasp the functional anatomy of the hip before working it.", duration: "2 min", linked_session_id: "p3_0" },
        { name: "Hip mobilization I", description: "Circles, openings, closings — full range of the hip in a single foundational session.", duration: "20 min", linked_session_id: "p3_5" },
        { name: "Releasing the flexors", description: "Psoas and iliacus, shortened by sitting, lengthen here in the awareness of movement.", duration: "22 min", linked_session_id: "p3_6" },
        { name: "Knee mobility", description: "Specific work on kneecap stability and femur-tibia alignment. Crucial for anyone walking, running, or playing sports.", duration: "20 min", linked_session_id: "p3_8" },
        { name: "The ankle in action", description: "Mobilization and strengthening of the ankles — the invisible foundation of the body's balance.", duration: "22 min", linked_session_id: "p3_9" },
      ],
      recommended_programs: [
        { goal: "Mobility", duration_weeks: 4, frequency: 4, label: "Free hips and pelvis" },
        { goal: "Stability", duration_weeks: 6, frequency: 3, label: "Strengthen knees and ankles" },
        { goal: "Posture", duration_weeks: 8, frequency: 3, label: "Integrated lower body" },
      ],
    },

    p4: {
      hero_subtitle: "The invisible architecture of your body",
      anatomy: [
        "Posture isn't standing straight — it's standing aligned. The spine draws four natural curves (cervical lordosis, thoracic kyphosis, lumbar lordosis, sacrum) that absorb shocks and distribute loads. When these curves exaggerate or flatten, the entire system suffers.",
        "The pelvis is the keystone. Its tilt (anterior or posterior) governs everything above and below. An overly anterior tilt arches the lumbar; an overly posterior one erases the lordosis and crushes the low back.",
        "The head weighs about five kilos in a neutral position. Tilted 30 degrees forward (the typical phone posture), it weighs 18 kilos on the cervicals. Equivalent to a child hanging on your neck — all day.",
        "Good posture is never fixed — it's a permanent dance of micro-adjustments. The body sways constantly around a central axis. Awareness of that axis is what we seek to cultivate.",
      ],
      why_matters: [
        { icon: "screen", text: "‟Tech neck\" — neck strained toward a screen — has become epidemic. Migraines, neck pain, eye fatigue are direct consequences." },
        { icon: "office", text: "Bad sitting posture crushes digestive organs, restricts breathing, slows circulation. Overall well-being passes through alignment." },
        { icon: "sport", text: "In sports, posture means efficiency. The same gesture performed aligned consumes less energy and preserves joints." },
        { icon: "aging", text: "Posture betrays age far more than wrinkles. An upright, free silhouette visually rejuvenates by ten years — with no intervention." },
      ],
      pilates_approach: [
        "Pilates doesn't ask you to ‟stand up straight.\" It teaches where the support points are, how weight flows, what ‟central axis\" means. Posture then emerges on its own, without effort.",
        "The approach builds in three steps: become aware (where I really am, regardless of the mirror image), release (the blockages preventing alignment), activate (the deep stabilizers that maintain alignment without tension).",
        "After a few sessions, you'll feel something strange: you hold yourself upright without thinking. It's no longer a voluntary effort — it's become a natural organization of the body. That's what we call postural integration.",
        "Postural work is probably the most durable benefit of Pilates. The exercises pass — posture stays. It's a long-term investment in quality of life.",
      ],
      sabrina_quote: "Standing tall doesn't mean stiffening. It means aligning — and letting the skeleton do its job.",
      key_movements: [
        { name: "Posture explained", description: "Understand the 4 natural curves of the spine and the central axis. Theoretical foundation before practice.", duration: "12 min", linked_session_id: "p4_0" },
        { name: "Feeling alignment", description: "Proprioception exercise: feel where the body is, regardless of what you see. The mirror lies, sensation doesn't.", duration: "12 min", linked_session_id: "p4_3" },
        { name: "Rebalancing the pelvis", description: "Specific work on pelvic tilt — the keystone of all posture.", duration: "25 min", linked_session_id: "p4_7" },
        { name: "Aligning the neck", description: "Replacing the head on the column. A salutary gesture after years of phone and screen.", duration: "22 min", linked_session_id: "p4_8" },
        { name: "Standing consciously", description: "Learning to stand — truly. No tension, no effort, in the axis.", duration: "25 min", linked_session_id: "p4_10" },
      ],
      recommended_programs: [
        { goal: "Alignment", duration_weeks: 4, frequency: 4, label: "Rebuild your posture" },
        { goal: "Office", duration_weeks: 3, frequency: 5, label: "Anti tech-neck" },
        { goal: "Integration", duration_weeks: 8, frequency: 3, label: "Posture for life" },
      ],
    },

    p5: {
      hero_subtitle: "The silent rhythm that flows through you",
      anatomy: [
        "You breathe about 20,000 times a day. And yet, unless you practice, you have almost no awareness of this movement. Breath is the only autonomous system you can also control voluntarily — it's your bridge between body and mind.",
        "The diaphragm is your main respiratory muscle. A muscular dome that descends on inhalation (making the belly rise) and ascends on exhalation. When free, it moves 7 to 10 cm per cycle. When tense, barely 2 or 3.",
        "Breath is three-dimensional: it expands forward (the belly), but also sideways (floating ribs) and backward (the back breathes too). Most of us use only a fraction of our breathing capacity.",
        "The nervous system follows the breath. A short, high-chest breath activates stress. A long, slow, deep breath activates calm. It's a physiological switch you can learn to operate at will.",
      ],
      why_matters: [
        { icon: "tension", text: "70% of chronic stress is respiratory. Learning to breathe deeply is probably the most accessible way to calm the nervous system." },
        { icon: "sleep", text: "A calmed breath prepares for sleep. Five minutes of conscious breathing in the evening transforms night quality." },
        { icon: "energy", text: "Oxygenation is cellular fuel. Better breathing means more energy, without coffee, without extra effort." },
        { icon: "sport", text: "In physical activity, coordinated breathing optimizes effort. It's what separates accomplished athletes from the rest." },
      ],
      pilates_approach: [
        "Pilates has a unique respiratory signature: lateral breathing. Inhale by expanding the sides and back (not the belly), exhale by engaging the pelvic floor and the transverse abdominis. This technique lets you brace while breathing — impossible with classic belly breathing.",
        "Joseph Pilates said: ‟Above all, learn to breathe correctly.\" His entire method rests on this base. Every movement syncs with a breath cycle — effort on exhale, opening on inhale.",
        "You'll discover entirely new sensations: ribs opening laterally, the back breathing, the perineum activating at the end of exhalation. After a few weeks, your resting breath will spontaneously change — deeper, slower, more efficient.",
        "Breath is the most powerful tool you possess to transform your inner state. Pilates teaches you to master it not as discipline, but as a way of living.",
      ],
      sabrina_quote: "Breathe. The rest will follow. Breathing is the conductor of all movement.",
      key_movements: [
        { name: "Understanding the breath", description: "Introductory video: what does breathing really mean? The minimum to know before any respiratory work.", duration: "12 min", linked_session_id: "p5_0" },
        { name: "3D breathing", description: "Discovering that breath expands in three directions, not just the belly. Foundational sensation.", duration: "15 min", linked_session_id: "p5_4" },
        { name: "Cardiac coherence I", description: "Simple and powerful practice: 5 seconds inhale, 5 seconds exhale. Nervous system balancing.", duration: "12 min", linked_session_id: "p5_5" },
        { name: "Lateral breathing", description: "The Pilates respiratory signature. Essential to combine bracing and breathing.", duration: "18 min", linked_session_id: "p5_7" },
        { name: "Pilates breathing I", description: "Integrating Pilates breath with movement. The bridge between theory and practice.", duration: "20 min", linked_session_id: "p5_10" },
      ],
      recommended_programs: [
        { goal: "Calm", duration_weeks: 2, frequency: 7, label: "Daily 5-min anti-stress" },
        { goal: "Breath", duration_weeks: 4, frequency: 4, label: "Master conscious breathing" },
        { goal: "Integration", duration_weeks: 6, frequency: 3, label: "Breath and movement united" },
      ],
    },

    p6: {
      hero_subtitle: "The sixth sense that changes everything",
      anatomy: [
        "You know five senses. You actually possess a sixth, the most precious: proprioception. It's the body's ability to locate itself in space without seeing. Close your eyes, raise an arm — you know where it is. That's proprioception.",
        "Millions of receptors, scattered through muscles, tendons, joints, and skin, send constant signals to the brain. This flood of information maps your body in real time. When the map is sharp, you move with ease. When it fades, you stumble, you lock, you injure.",
        "Proprioception degrades with sedentary life. It sharpens with conscious movement. That's why Pilates practitioners, dancers, gymnasts have remarkable coordination late into life — their inner map stays precise.",
        "This bodily intelligence also links to fall prevention after 60, post-injury healing, gesture mastery. It's probably the most neglected sense — and the most crucial.",
      ],
      why_matters: [
        { icon: "aging", text: "Falls are the leading cause of hospitalization after 65. Maintained proprioception is the best prevention." },
        { icon: "sport", text: "In sports, it's what makes the difference between a clean gesture and an injuring one. High-level athletes train it specifically." },
        { icon: "tension", text: "Many chronic tensions stem from a bad reading of the body. When proprioception restores, certain pains fade away." },
        { icon: "office", text: "At the office, without bodily landmarks, we slump without noticing. Proprioception helps real-time correction." },
      ],
      pilates_approach: [
        "Pilates is, perhaps above all, proprioceptive training. Every exercise demands feeling precisely where the body is, what it does, how it moves. It's that sustained attention that develops bodily intelligence.",
        "We work with eyes closed, we work slowly, we work with attention to detail. Not because of slowness — because of density. One minute of conscious movement equals ten minutes of automatic movement.",
        "You'll discover, session after session, that your body has a language. That it constantly speaks to you, but you weren't listening. That your two sides aren't symmetric, your feet land differently, your breath isn't the same depending on the time of day.",
        "This awareness, once awakened, never goes out again. It follows you in walking, in sports, in sleep. It's probably the most precious gift Pilates gives its practitioners — the encounter with your own body.",
      ],
      sabrina_quote: "The body knows. You just need to learn to listen. Body awareness is cultivated, day after day.",
      key_movements: [
        { name: "What is proprioception", description: "Understanding this sixth sense before awakening it. Essential theory for what follows.", duration: "12 min", linked_session_id: "p6_0" },
        { name: "Body scan I", description: "First practice of listening to the body. Head to foot, feel without trying to change.", duration: "12 min", linked_session_id: "p6_3" },
        { name: "Feeling without seeing", description: "Work with eyes closed. Proprioception develops when you remove vision.", duration: "15 min", linked_session_id: "p6_4" },
        { name: "Static balance I", description: "Standing on one foot — the foundational proprioceptive exercise. Simple in appearance, rich in sensation.", duration: "15 min", linked_session_id: "p6_5" },
        { name: "Slow movement I", description: "Performing a known gesture at 10% of normal speed. You'll discover everything you weren't perceiving.", duration: "20 min", linked_session_id: "p6_10" },
      ],
      recommended_programs: [
        { goal: "Awakening", duration_weeks: 3, frequency: 4, label: "Cultivate your sixth sense" },
        { goal: "Balance", duration_weeks: 6, frequency: 3, label: "Stability and coordination" },
        { goal: "Meditation", duration_weeks: 8, frequency: 4, label: "Movement and presence" },
      ],
    },

    p7: {
      hero_subtitle: "Joseph Pilates' original work",
      anatomy: [
        "Mat Pilates is Pilates in its purest form: on the floor, no machines, with your own body as the only resistance. Joseph Pilates designed this series of movements in the 1920s, during WWI. Nearly a century later, its relevance hasn't aged a day.",
        "Mat rests on six intangible principles: concentration, control, center, flow, precision, breath. All work together. No movement is performed without at least four of these principles present.",
        "The ‟powerhouse\" — the energy center — extends from the bottom of the ribs to the pelvic floor. It's the origin of all movement in Pilates. When the center is engaged, arms and legs can move freely, like the branches of a deeply rooted tree.",
        "Mat is practiced barefoot, in silence (or with discreet music), with sustained concentration. It's not a fitness class — it's a practice. Closer to yoga or internal martial arts than to classic sport.",
      ],
      why_matters: [
        { icon: "home", text: "Mat can be done anywhere. A mat and a square meter are enough. No excuse, no equipment to buy, no gym to attend." },
        { icon: "energy", text: "A balanced 25-minute session mobilizes the entire body. It's one of the most complete workouts you can practice." },
        { icon: "aging", text: "Joseph Pilates practiced until age 87. Mat is a method for life — adaptable to any age, any physical condition." },
        { icon: "tension", text: "Beyond the physical, Mat soothes. The required concentration silences mental noise. Many describe it as active meditation." },
      ],
      pilates_approach: [
        "Mat's approach is unique in its progression: start at the center, then integrate the extremities. Before the Hundred (the emblematic movement), there are six preparations. Before the series of 5, there are weeks of transverse activation.",
        "Each exercise has a name, a precise intention, a codified execution. It's not free fitness — it's a repertoire transmitted over nearly a century, refined by thousands of practitioners. This discipline is what makes the method effective.",
        "You'll quickly feel two things: first, it's harder than you thought (slow movements require real strength); second, it's subtler than you thought (sensation prevails over performance).",
        "Practice Mat three times a week for three months — you'll be different. That's the realistic promise of the method. Not a spectacular transformation, but a deep change in bodily quality.",
      ],
      sabrina_quote: "Pilates is not exercise. It's an art of living.",
      key_movements: [
        { name: "Joseph Pilates & his method", description: "Founding story. Understand where the method comes from before practicing it.", duration: "12 min", linked_session_id: "p7_0" },
        { name: "The 6 Mat principles", description: "Concentration, control, center, flow, precision, breath. The six foundations to integrate.", duration: "15 min", linked_session_id: "p7_1" },
        { name: "The center — powerhouse", description: "Locating and activating the energy center. The doorway into all practice.", duration: "15 min", linked_session_id: "p7_2" },
        { name: "The Hundred — initiation", description: "Joseph Pilates' emblematic exercise. To approach progressively, but unmissable.", duration: "20 min", linked_session_id: "p7_5" },
        { name: "The series of 5", description: "Five chained exercises that awaken the entire center. The heart of beginner practice.", duration: "25 min", linked_session_id: "p7_10" },
      ],
      recommended_programs: [
        { goal: "Begin", duration_weeks: 4, frequency: 3, label: "Discovering Mat" },
        { goal: "Deepen", duration_weeks: 8, frequency: 3, label: "Intermediate Mat" },
        { goal: "Master", duration_weeks: 12, frequency: 4, label: "Advanced Mat and full flow" },
      ],
    },

    p8: {
      hero_subtitle: "Reclaim your body between two meetings",
      anatomy: [
        "The human body isn't designed to sit eight hours a day. That's a biological fact. Across 200,000 years of Homo sapiens evolution, the office chair has, at scale, thirty seconds of history. Our anatomy pays the price.",
        "In prolonged sitting, several things happen: hip flexors shorten, glutes deactivate, abs slacken, lumbar compresses, neck juts forward, trapezius contracts. A true slow, silent collapse process.",
        "Eyes fixed on a screen reduce blink frequency by 60%. The tilted neck multiplies cervical load by 4. Permanently hyperextended wrists open the door to carpal tunnel syndrome. It's a hostile environment for the body.",
        "Good news: 5 to 10 minutes of targeted movement every 90 minutes is enough to neutralize most of these effects. The body is resilient — it just asks to be listened to a little.",
      ],
      why_matters: [
        { icon: "screen", text: "Back pain is the leading cause of sick leave in office jobs. Prevention is a thousand times better than cure." },
        { icon: "office", text: "A 5-min active break improves concentration of the following 25 minutes. It's an investment, not a waste of time." },
        { icon: "tension", text: "Office neck pain climbs into migraines. Mobilizing the neck often heals the head." },
        { icon: "energy", text: "Sedentary life fatigues more than it rests. Moving a little gives more energy than a coffee break." },
      ],
      pilates_approach: [
        "Office Pilates adapts core principles to office constraints: little time, little space, work clothes, sometimes colleagues' eyes. Movements are short (3 to 10 minutes), doable on or next to the chair, discreet if needed.",
        "The approach targets precisely the zones the office damages: neck, shoulders, lumbar, hips, wrists. No long session — micro-practices, more effective than an intensive weekend class.",
        "You'll discover it's possible to transform sitting into subtle movement: pelvic tilt, thoracic rotation, chain stretching, conscious breathing. The chair becomes a tool, not a prison.",
        "Most important: regularity. Three micro-breaks in the day — morning, noon, afternoon — vastly beat a weekly classic Pilates session. Consistency beats intensity.",
      ],
      sabrina_quote: "The true enemy of the back is a sedentary life. Moving a little, often, is the antidote.",
      key_movements: [
        { name: "Why the office tires", description: "Understand the mechanisms by which sitting damages the body. Prerequisite to all action.", duration: "5 min", linked_session_id: "p8_0" },
        { name: "Seated neck stretches", description: "Five minutes to release the neck without leaving the chair. Repeat three times a day.", duration: "5 min", linked_session_id: "p8_5" },
        { name: "Shoulders at desk — release", description: "Discreet shoulder mobilization. Ideal between two video calls.", duration: "7 min", linked_session_id: "p8_7" },
        { name: "Active micro-break — 3 min", description: "Three minutes, standing next to the chair. Complete body and attention reset.", duration: "3 min", linked_session_id: "p8_12" },
        { name: "Morning office routine", description: "Start the day with 8 minutes of body prep. Radically changes the posture of the day.", duration: "8 min", linked_session_id: "p8_18" },
      ],
      recommended_programs: [
        { goal: "Prevention", duration_weeks: 4, frequency: 5, label: "Daily anti tech-neck" },
        { goal: "Energy", duration_weeks: 3, frequency: 5, label: "Transformative active breaks" },
        { goal: "Posture", duration_weeks: 6, frequency: 5, label: "Rebuild posture at work" },
      ],
    },

    p9: {
      hero_subtitle: "Crossing this passage with awareness",
      anatomy: [
        "Menopause isn't a disease. It's a major biological passage — the progressive halt of estrogen and progesterone production. For the body, it's a silent earthquake: bone density eroding, muscle mass declining, metabolism slowing, skin changing.",
        "Estrogen used to protect bone, muscle, heart, brain. Its decrease accelerates aging across multiple systems at once. Osteoporosis threatens, sarcopenia (muscle loss) accelerates, the pelvic floor weakens.",
        "The pelvic floor deserves particular attention. Composed of deep muscles supporting the bladder, uterus, and intestines, it weakens with hormonal decline. Its rehabilitation is one of the most useful actions of this period.",
        "But this passage isn't only loss. It's also a moment of liberation, redefinition, body reclamation. Well-accompanied, a new power settles in — different from the old, but real.",
      ],
      why_matters: [
        { icon: "aging", text: "Bone density drops 2 to 5% per year in early menopause. Weight-bearing Pilates drastically slows this loss." },
        { icon: "sleep", text: "Hot flashes disturb sleep. Breathing techniques soothe both nervous system and thermal regulation." },
        { icon: "energy", text: "Muscle loss (sarcopenia) accelerates after 50. Regular work, even moderate, slows it — even reverses it." },
        { icon: "tension", text: "Stress amplifies all symptoms. Working breath and bodily mindfulness changes the experience of this period." },
      ],
      pilates_approach: [
        "Pilates is particularly suited to menopause: it works with load (good for bone), preserves muscle mass (essential), integrates breath (hormonal and emotional regulation), rehabs the pelvic floor (often neglected).",
        "The approach is progressive and respectful. No generic program — every body crosses menopause differently. The work adapts: softer on fatigued days, more tonic on energetic days. Regularity prevails over intensity.",
        "You'll discover that instead of enduring this period, you can cross it actively. Conscious movement becomes an ally — it acts on sleep, mood, self-confidence, the changing relationship with the body.",
        "The benefit builds long-term. It's not the effect of one session, but of a practice. Three months of regular Pilates transforms daily life more than any isolated treatment. It's an investment in the next twenty years.",
      ],
      sabrina_quote: "Menopause isn't an ending — it's a stage. With the right movement, it can become a rebirth.",
      key_movements: [
        { name: "Menopause explained", description: "Understanding what's happening in the body. The first step to stop enduring.", duration: "6 min", linked_session_id: "p9_0" },
        { name: "Your pelvic floor, with awareness", description: "Locate, feel, activate the pelvic floor. Foundational work for everything that follows.", duration: "9 min", linked_session_id: "p9_3" },
        { name: "Breathe to ease hot flashes", description: "Specific breathing techniques to soothe hot flashes. Practice at the first signs.", duration: "8 min", linked_session_id: "p9_4" },
        { name: "Strong bones", description: "Load-bearing work to preserve bone density. The best osteoporosis prevention.", duration: "20 min", linked_session_id: "p9_7" },
        { name: "Restorative sleep", description: "Evening sequence to prepare the body for sleep. Particularly precious in menopause.", duration: "17 min", linked_session_id: "p9_9" },
      ],
      recommended_programs: [
        { goal: "Adapt", duration_weeks: 4, frequency: 3, label: "Accompany the first symptoms" },
        { goal: "Bone & muscle", duration_weeks: 8, frequency: 4, label: "Preserve bodily capital" },
        { goal: "Vitality", duration_weeks: 12, frequency: 3, label: "Recover energy and confidence" },
      ],
    },
  },
};

// Localized accessor with French fallback.
export function getPilierContent(lang, pilierKey) {
  const bag = PILIER_CONTENT[lang] || PILIER_CONTENT.fr;
  return bag[pilierKey] || PILIER_CONTENT.fr[pilierKey] || null;
}
