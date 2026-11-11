/** The 32-column character grid that screens paint into. */
export type Cell = {
  bright: boolean;
  flash?: boolean;
  ink: number;
  inverse: boolean;
  paper: number;
  pixels?: readonly number[];
  text: string;
};
export type Style = Partial<Omit<Cell, 'text'>>;

export type Paint = (
  row: number,
  column: number,
  text: string,
  style?: Style
) => void;
