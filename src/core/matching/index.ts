export {
  FOUND_THRESHOLD,
  MAX_CANDIDATES,
  UNCERTAIN_THRESHOLD,
  matchTrack,
  statusFromScore,
  type MatchStatus,
  type TrackMatch,
} from "./match";
export {
  normalizeText,
  parseTitle,
  splitArtists,
  type ParsedTitle,
  type VersionTag,
} from "./normalize";
export { scoreCandidate, type ScoreDetails, type ScoredCandidate } from "./score";
