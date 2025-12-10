-- Add insight_type column to insights table for image analysis
ALTER TABLE public.insights 
ADD COLUMN IF NOT EXISTS insight_type TEXT DEFAULT 'message_analysis';

-- Add image_analysis_data column to store full image analysis JSON
ALTER TABLE public.insights 
ADD COLUMN IF NOT EXISTS image_analysis_data JSONB;

-- Create index for efficient querying by insight_type
CREATE INDEX IF NOT EXISTS idx_insights_type ON public.insights(insight_type);

-- Add comment for documentation
COMMENT ON COLUMN public.insights.insight_type IS 'Type of insight: message_analysis, audio_analysis, image_analysis';
COMMENT ON COLUMN public.insights.image_analysis_data IS 'Full JSON data from image analysis including description, OCR, detected_type, etc';